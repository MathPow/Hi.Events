import {Alert, Switch, Textarea, TextInput} from "@mantine/core";
import {t} from "@lingui/macro";
import {UseFormReturnType} from "@mantine/form";
import {CheckInListRequest, ProductCategory, ProductType} from "../../../types.ts";
import {InputGroup} from "../../common/InputGroup";
import {ProductSelector} from "../../common/ProductSelector";
import {useEffect, useMemo} from "react";
import {IconInfoCircle} from "@tabler/icons-react";

interface CheckInListFormProps {
    form: UseFormReturnType<CheckInListRequest>;
    productCategories: ProductCategory[];
}

export const CheckInListForm = ({form, productCategories}: CheckInListFormProps) => {
    const tickets = useMemo(() => {
        return productCategories
            .flatMap(category => category.products || [])
            .filter(product => product.product_type === ProductType.Ticket);
    }, [productCategories]);

    useEffect(() => {
        if (tickets.length === 1 && (!form.values.product_ids || form.values.product_ids.length === 0)) {
            form.setFieldValue('product_ids', [String(tickets[0].id)]);
        }
    }, [tickets]);

    return (
        <>
            <Alert mb={20} icon={<IconInfoCircle size={16}/>} color="blue" variant="light">
                {t`Check-in lists let you control entry across days, areas, or ticket types. You can share a secure check-in link with staff — no account required.`}
            </Alert>

            <TextInput
                {...form.getInputProps('name')}
                required
                label={t`Name`}
                placeholder={t`VIP check-in list`}
            />

            <ProductSelector
                label={t`Which tickets should be associated with this check-in list?`}
                placeholder={t`Select tickets`}
                productCategories={productCategories}
                form={form}
                productFieldName="product_ids"
                includedProductTypes={[ProductType.Ticket]}
            />

            <Textarea
                {...form.getInputProps('description')}
                label={t`Description for check-in staff`}
                placeholder={t`Add a description for this check-in list`}
                description={t`Visible to check-in staff only. Helps identify this list during check-in.`}
                minRows={2}
            />

            <InputGroup>
                <TextInput
                    {...form.getInputProps('activates_at')}
                    type="datetime-local"
                    label={t`Activation date`}
                    description={t`When check-in opens`}
                />
                <TextInput
                    {...form.getInputProps('expires_at')}
                    type="datetime-local"
                    label={t`Expiration date`}
                    description={t`When check-in closes`}
                />
            </InputGroup>

            <TextInput
                {...form.getInputProps('pin')}
                mt={20}
                inputMode="numeric"
                maxLength={12}
                label={t`Check-in PIN`}
                placeholder={t`e.g. 4821`}
                description={t`Digits only, 4 to 12. Anyone with the check-in link can see your attendee list and undo check-ins, so give this code to your staff and leave it set.`}
            />

            <Switch
                {...form.getInputProps('allow_door_sales', {type: 'checkbox'})}
                mt={20}
                label={t`Allow selling tickets at the door`}
                description={t`Check-in staff can sell any remaining tickets from this list. Take the payment on your own card terminal or in cash — the ticket is issued and checked in on the spot.`}
            />
        </>
    );
}
