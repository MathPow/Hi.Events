<?php

declare(strict_types=1);

namespace HiEvents\Http\Request\Product;

use HiEvents\DomainObjects\Enums\ProductPriceType;
use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\Http\Request\BaseRequest;
use HiEvents\Validators\Rules\RulesHelper;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UpsertProductRequest extends BaseRequest
{
    /**
     * Le type DONATION et la part charity_amount annoncent un don au sens
     * fiscal. Tant que l'organisateur n'a pas de numero d'enregistrement, aucun
     * recu ne peut etre emis: on refuse cote serveur, pas seulement dans l'UI,
     * ou un simple appel API contournerait le garde-fou.
     *
     * Un produit DEJA en DONATION reste modifiable: bloquer sa sauvegarde
     * rendrait inaccessible un produit cree avant que le reglage ne soit vide.
     */
    public function after(): array
    {
        return [
            function ($validator) {
                $wantsDonationType = $this->input('type') === ProductPriceType::DONATION->name;
                $wantsCharitySplit = (float)$this->input('charity_amount', 0) > 0;

                if (!$wantsDonationType && !$wantsCharitySplit) {
                    return;
                }

                if ($this->organizerIsRegisteredCharity()) {
                    return;
                }

                if ($wantsCharitySplit) {
                    $validator->errors()->add(
                        'charity_amount',
                        __('Add your charity registration number in the organizer settings before splitting a price into a donation.')
                    );
                }

                if ($wantsDonationType && !$this->productIsAlreadyDonation()) {
                    $validator->errors()->add(
                        'type',
                        __('Add your charity registration number in the organizer settings before creating a donation product.')
                    );
                }
            },
        ];
    }

    private function organizerIsRegisteredCharity(): bool
    {
        $organizerId = DB::table('events')
            ->where('id', $this->route('event_id'))
            ->value('organizer_id');

        if ($organizerId === null) {
            return false;
        }

        return trim((string)DB::table('organizer_settings')
            ->where('organizer_id', $organizerId)
            ->value('charity_registration_number')) !== '';
    }

    private function productIsAlreadyDonation(): bool
    {
        $productId = $this->route('ticket_id');

        if ($productId === null) {
            return false;
        }

        return DB::table('products')
                ->where('id', $productId)
                ->value('type') === ProductPriceType::DONATION->name;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|max:255',
            'initial_quantity_available' => 'integer|nullable',
            'quantity_sold' => 'integer|default:0',
            'sale_start_date' => 'date|nullable',
            'sale_end_date' => 'date|nullable|after:sale_start_date',
            'max_per_order' => 'integer|nullable',
            'prices' => ['required', 'array'],
            'prices.*.price' => [...RulesHelper::MONEY, 'required'],
            'prices.*.label' => ['nullable', ...RulesHelper::STRING, 'required_if:type,' . ProductPriceType::TIERED->name],
            'prices.*.sale_start_date' => ['date', 'nullable', 'after:sale_start_date'],
            'prices.*.sale_end_date' => 'date|nullable|after:prices.*.sale_start_date',
            'prices.*.initial_quantity_available' => ['integer', 'nullable', 'min:0'],
            'prices.*.is_hidden' => ['boolean'],
            'description' => 'string|nullable',
            'min_per_order' => 'integer|nullable',
            'is_hidden' => 'boolean',
            'hide_before_sale_start_date' => 'boolean',
            'hide_after_sale_end_date' => 'boolean',
            'hide_when_sold_out' => 'boolean',
            'start_collapsed' => 'boolean',
            'show_quantity_remaining' => 'boolean',
            'is_hidden_without_promo_code' => 'boolean',
            'type' => ['required', Rule::in(ProductPriceType::valuesArray())],
            'product_type' => ['required', Rule::in(ProductType::valuesArray())],
            'tax_and_fee_ids' => 'array',
            'product_category_id' => ['required', 'integer'],
            'is_highlighted' => 'boolean',
            'highlight_message' => 'string|nullable|max:255',
            'waitlist_enabled' => 'boolean|nullable',
            // Part du prix qui constitue un don, par unite. Bornee au prix
            // lui-meme: au-dela, le recu depasserait la somme reellement recue.
            'charity_amount' => ['nullable', ...RulesHelper::MONEY, 'lte:prices.0.price'],
        ];
    }

    public function messages(): array
    {
        return [
            'sale_end_date.after' => __('The sale end date must be after the sale start date.'),
            'prices.*.sale_end_date.after' => __('The sale end date must be after the sale start date.'),
            'prices.*.sale_end_date.date' => __('The sale end date must be a valid date.'),
            'prices.*.sale_start_date.after' => __('The sale start date must be after the product sale start date.'),
            'product_category_id.required' => __('You must select a product category.'),
            'charity_amount.lte' => __('The donation portion cannot exceed the ticket price.'),
        ];
    }
}
