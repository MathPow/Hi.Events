import {ReactNode, useEffect, useState} from 'react';
import {t} from "@lingui/macro";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    Modifier,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {Event, Product, ProductCategory, ProductType} from "../../../types.ts";
import {useSortProducts} from "../../../mutations/useSortProducts.ts";
import {showError} from "../../../utilites/notifications.tsx";
import {ProductRow} from "./ProductRow.tsx";
import classes from "./ProductsTable.module.scss";

export type ProductKind = 'ticket' | 'product';

interface Entry {
    key: string;
    product: Product;
    categoryId: number;
}

const kindOf = (product: Product): ProductKind => product.product_type === ProductType.Ticket ? 'ticket' : 'product';

const verticalOnly: Modifier = ({transform}) => ({...transform, x: 0});

// Category by category, as on the public page: a section shows its rows in that order.
const entriesOf = (categories: ProductCategory[]): Entry[] => categories.flatMap((category) =>
    (category.products || []).map((product) => ({
        key: `product-${product.id}`,
        product,
        categoryId: category.id as number,
    })));

interface SectionProps {
    kind: ProductKind;
    entries: Entry[];
    event: Event;
    onReorder: (kind: ProductKind, entries: Entry[], movedKey: string, overKey: string) => void;
    onAdd: (kind: ProductKind) => void;
}

const Section = ({kind, entries, event, onReorder, onAdd}: SectionProps) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
    );
    const isTicket = kind === 'ticket';

    const onDragEnd = ({active, over}: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }
        const keys = entries.map((entry) => entry.key);
        onReorder(kind, arrayMove(entries, keys.indexOf(String(active.id)), keys.indexOf(String(over.id))),
            String(active.id), String(over.id));
    };

    const plus = (children: ReactNode) => (
        <button type="button" className={classes.addRow} onClick={() => onAdd(kind)}>
            <img src={'/interface/admin/produits/plus-18.svg'} width={18} height={18} alt=""/>
            {children}
        </button>
    );

    return (
        <section className={classes.section} aria-labelledby={`products-${kind}`}>
            <div className={classes.sectionHeader}>
                <h2 id={`products-${kind}`} className={classes.sectionTitle}>
                    {isTicket ? t`Tickets` : t`Products`}
                    <span className={classes.count}>{entries.length}</span>
                </h2>
                {entries.length > 1 && <span className={classes.hint}>{t`Drag to change the order on the page`}</span>}
            </div>
            {!isTicket && (
                <p className={classes.sectionText}>{t`Merch to pick up on site, sold on its own as an extra at checkout.`}</p>
            )}

            {entries.length === 0 && (
                <p className={classes.empty}>{isTicket ? t`No tickets yet.` : t`No products yet.`}</p>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
                        modifiers={[verticalOnly]}>
                <SortableContext items={entries.map((entry) => entry.key)} strategy={verticalListSortingStrategy}>
                    <div className={classes.rows}>
                        {entries.map((entry) => (
                            <ProductRow key={entry.key} id={entry.key} product={entry.product} event={event}
                                        draggable={entries.length > 1}/>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {plus(isTicket ? t`Add a ticket` : t`Add a product`)}
        </section>
    );
};

interface ProductSectionsProps {
    initialCategories: ProductCategory[];
    event: Event;
    onAdd: (kind: ProductKind) => void;
}

/**
 * The two cards of Figma « Billets et produits »: the tickets, then the products (merch) sold as extras.
 * Categories stay behind the scenes (the public page still groups by them): a dragged row takes the
 * category of the row it lands on, and each category keeps its rows in the order shown.
 */
export const ProductSections = ({initialCategories, event, onAdd}: ProductSectionsProps) => {
    const [categories, setCategories] = useState<ProductCategory[]>(initialCategories);
    const sortMutation = useSortProducts();

    useEffect(() => setCategories(initialCategories), [initialCategories]);

    const entries = entriesOf(categories);
    const tickets = entries.filter((entry) => kindOf(entry.product) === 'ticket');
    const products = entries.filter((entry) => kindOf(entry.product) === 'product');

    const reorder = (kind: ProductKind, reordered: Entry[], movedKey: string, overKey: string) => {
        const overCategory = reordered.find((entry) => entry.key === overKey)?.categoryId;
        const moved = reordered.map((entry) => entry.key === movedKey && overCategory !== undefined
            ? {...entry, categoryId: overCategory}
            : entry);
        const ordered = kind === 'ticket' ? [...moved, ...products] : [...tickets, ...moved];

        const updated = categories.map((category) => ({
            ...category,
            products: ordered.filter((entry) => entry.categoryId === category.id).map((entry) => entry.product),
        }));
        setCategories(updated);

        sortMutation.mutate({
            eventId: event.id,
            sortedCategories: updated.map((category) => ({
                product_category_id: category.id,
                sorted_products: (category.products || []).map((product, index) => ({
                    id: product.id as number,
                    order: index + 1,
                })),
            })),
        }, {
            onError: () => {
                setCategories(initialCategories);
                showError(t`Failed to sort products`);
            },
        });
    };

    return (
        <div className={classes.sections}>
            <Section kind="ticket" entries={tickets} event={event} onReorder={reorder} onAdd={onAdd}/>
            <Section kind="product" entries={products} event={event} onReorder={reorder} onAdd={onAdd}/>
        </div>
    );
};
