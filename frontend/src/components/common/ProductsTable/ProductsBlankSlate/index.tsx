import {NoResultsSplash} from "../../NoResultsSplash";
import {Button, UnstyledButton} from "@mantine/core";
import {IconPlus} from "@tabler/icons-react";
import {t, Trans} from "@lingui/macro";
import classes from "../ProductsTable.module.scss";

interface ProductsBlankSlateProps {
    openCreateModal: (categoryId?: string) => void;
    productCategories: any;
    searchTerm: string;
    // An empty category among others: a dashed card to add its first product.
    inCategory?: boolean;
}

export const ProductsBlankSlate = ({openCreateModal, productCategories, searchTerm, inCategory}: ProductsBlankSlateProps) => {
    const showLargeBlankSlate = productCategories
        .every((category: any) => category.products.length === 0) && productCategories.length === 1;

    if (searchTerm) {
        return (
            <NoResultsSplash
                icon="recherche"
                heading={t`No Search Results`}
                subHeading={(
                    <p>
                        <Trans>
                            We couldn't find any tickets matching {searchTerm ?
                            <strong>{searchTerm}</strong> : 'your search'}
                        </Trans>
                    </p>
                )}
            />
        );
    }

    if (showLargeBlankSlate || !inCategory) {
        return (
            <NoResultsSplash
                icon="billet"
                heading={t`No Products Yet`}
                subHeading={(
                    <p>
                        {t`You'll need at least one product to get started. Free, paid or let the user decide what to pay.`}
                    </p>
                )}
            >
                <Button leftSection={<IconPlus size={20}/>} onClick={() => openCreateModal()}>
                    {t`Add Product to Category`}
                </Button>
            </NoResultsSplash>
        );
    }

    return (
        <UnstyledButton className={classes.emptyCategory} onClick={() => openCreateModal()}>
            <span className={classes.emptyPlus} aria-hidden><IconPlus size={22} stroke={2.5}/></span>
            <span className={classes.emptyTitle}>{t`Add Product`}</span>
            <span className={classes.emptyText}>{t`This category doesn't have any products yet.`}</span>
        </UnstyledButton>
    );
}
