import {useEffect, useState} from "react";
import {useParams} from "react-router";
import {Button, Menu} from "@mantine/core";
import {t} from "@lingui/macro";
import {PageTitle} from "../../common/PageTitle";
import {PageBody} from "../../common/PageBody";
import {CreateProductModal} from "../../modals/CreateProductModal";
import {ProductKind, ProductSections, ProductSectionsSkeleton} from "../../common/ProductsTable";
import {useUrlHash} from "../../../hooks/useUrlHash.ts";
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {useGetEventProductCategories} from "../../../queries/useGetProductCategories.ts";
import {ProductType} from "../../../types.ts";
import classes from "./products.module.scss";

const ICONS = '/interface/admin/produits';
// Per viewer: once closed, the explanation stays closed in this browser.
// eslint-disable-next-line lingui/no-unlocalized-strings
const EXPLAINER_KEY = 'dehors.produits.explication-masquee';

const plusIcon = <img src={`${ICONS}/plus.svg`} width={20} height={20} alt=""/>;

// « Billets, forfaits et extras »: what a ticket and a product are, until closed with its X.
const Explainer = () => {
    const [hidden, setHidden] = useState(true);

    useEffect(() => {
        try {
            setHidden(window.localStorage.getItem(EXPLAINER_KEY) === '1');
        } catch {
            setHidden(false);
        }
    }, []);

    if (hidden) {
        return null;
    }

    const close = () => {
        setHidden(true);
        try {
            window.localStorage.setItem(EXPLAINER_KEY, '1');
        } catch {
            // Closed for this visit only.
        }
    };

    return (
        <div className={classes.explainer} role="note">
            <span className={classes.explainerIcon} aria-hidden>
                <img src={`${ICONS}/aide.svg`} width={20} height={20} alt=""/>
            </span>
            <div className={classes.explainerText}>
                <strong>{t`Tickets and extras`}</strong>
                <p>{t`A ticket gives access to the event. A product (e.g. a t-shirt) is sold on its own, as an extra, at checkout.`}</p>
            </div>
            <button type="button" className={classes.explainerClose} onClick={close}
                    aria-label={t`Hide this explanation`}>
                <img src={`${ICONS}/fermer.svg`} width={18} height={18} alt=""/>
            </button>
        </div>
    );
};

/**
 * Figma « Admin · Événement · Billets et produits » (542:2074, phone 542:2720): the tickets and the
 * products of the event. On phones, one « Ajouter » button asks which one to add.
 */
export const Products = () => {
    const {eventId} = useParams();
    const {data: event} = useGetEvent(eventId);
    const productCategoriesQuery = useGetEventProductCategories(eventId);
    const productCategories = productCategoriesQuery?.data?.data;
    const [creating, setCreating] = useState<ProductKind | null>(null);

    useUrlHash('create-product', () => setCreating('ticket'));

    const add = (kind: ProductKind) => setCreating(kind);

    return (
        <PageBody>
            <PageTitle
                subheading={t`What participants can buy for this event.`}
                mobileSubheading={null}
                actions={(
                    <>
                        <Button variant="outline" leftSection={plusIcon} className={classes.desktopOnly}
                                onClick={() => add('product')}>
                            {t`Add a product`}
                        </Button>
                        <Button leftSection={plusIcon} className={classes.desktopOnly} onClick={() => add('ticket')}>
                            {t`Add a ticket`}
                        </Button>
                        <Menu position="bottom" width="target" shadow="md">
                            <Menu.Target>
                                <Button leftSection={plusIcon} className={classes.phoneOnly} fullWidth>
                                    {t`Add`}
                                </Button>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item onClick={() => add('ticket')} className={classes.addChoice}
                                           leftSection={<img src={`${ICONS}/billet.svg`} width={20} height={20} alt=""/>}>
                                    {t`Ticket`}
                                </Menu.Item>
                                <Menu.Item onClick={() => add('product')} className={classes.addChoice}
                                           leftSection={<img src={`${ICONS}/sac.svg`} width={20} height={20} alt=""/>}>
                                    {t`Product`}
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    </>
                )}
            >{t`Tickets & Products`}</PageTitle>

            <Explainer/>

            {(!productCategories || !event) && <ProductSectionsSkeleton/>}

            {event && productCategories && (
                <ProductSections initialCategories={productCategories} event={event} onAdd={add}/>
            )}

            {creating && (
                <CreateProductModal
                    productType={creating === 'ticket' ? ProductType.Ticket : ProductType.General}
                    onClose={() => setCreating(null)}
                    isOpen
                />
            )}
        </PageBody>
    );
};

export default Products;
