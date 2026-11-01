import {useParams} from "react-router";
import {useDisclosure} from "@mantine/hooks";
import {Button} from "@mantine/core";
import {IconCategoryPlus, IconPlus} from "@tabler/icons-react";
import {PageTitle} from "../../common/PageTitle";
import {PageBody} from "../../common/PageBody";
import {CreateProductModal} from "../../modals/CreateProductModal";
import {ProductCategoryList} from "../../common/ProductsTable";
import {ToolBar} from "../../common/ToolBar";
import {TableSkeleton} from "../../common/TableSkeleton";
import {t} from "@lingui/macro";
import {useUrlHash} from "../../../hooks/useUrlHash.ts";
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {useGetEventProductCategories} from "../../../queries/useGetProductCategories.ts";
import {SearchBar} from "../../common/SearchBar";
import {useState} from "react";
import {CreateProductCategoryModal} from "../../modals/CreateProductCategoryModal";
import {IdParam} from "../../../types.ts";

export const Products = () => {
    const [createProductModalOpen, {
        open: openCreateProductModal,
        close: closeCreateProductModal
    }] = useDisclosure(false);
    const [createProductCategoryModalOpen, {
        open: openCreateProductCategoryModal,
        close: closeCreateProductCategoryModal
    }] = useDisclosure(false);
    const {eventId} = useParams();
    const {data: event} = useGetEvent(eventId);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<IdParam>();

    const productCategoriesQuery = useGetEventProductCategories(eventId);
    const productCategories = productCategoriesQuery?.data?.data;

    useUrlHash('create-product', () => openCreateProductModal());

    const openCreateProduct = (categoryId: IdParam) => {
        setSelectedCategoryId(() => categoryId);
        openCreateProductModal();
    }

    return (
        <PageBody>
            <PageTitle
                subheading={t`Create and configure tickets and merchandise for sale.`}
                actions={(
                    <>
                        <Button
                            variant="outline"
                            leftSection={<IconCategoryPlus size={20}/>}
                            onClick={openCreateProductCategoryModal}
                        >
                            {t`Create category`}
                        </Button>
                        <Button
                            leftSection={<IconPlus size={20}/>}
                            onClick={() => openCreateProduct(undefined)}
                        >
                            {t`Add a ticket or product`}
                        </Button>
                    </>
                )}
            >{t`Tickets & Products`}</PageTitle>

            <ToolBar
                searchComponent={() => (
                    <SearchBar
                        onClear={() => setSearchTerm('')}
                        placeholder={t`Search products`}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                )}
            />

            <TableSkeleton isVisible={!productCategories || !event}/>

            {(event && productCategories)
                && (<ProductCategoryList
                        initialCategories={productCategories}
                        event={event}
                        searchTerm={searchTerm}
                        onCreateOpen={openCreateProduct}
                    />
                )}

            {createProductModalOpen &&
                <CreateProductModal selectedCategoryId={selectedCategoryId} onClose={closeCreateProductModal}
                                    isOpen={createProductModalOpen}/>}
            {createProductCategoryModalOpen && <CreateProductCategoryModal onClose={closeCreateProductCategoryModal}
                                                                           isOpen={createProductCategoryModalOpen}/>}
        </PageBody>
    );
};

export default Products;
