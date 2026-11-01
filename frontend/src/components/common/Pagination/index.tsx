import {Box, Pagination as MantinePagination, PaginationProps as MantinePaginationProps} from "@mantine/core";
import classes from "./Pagination.module.scss";

interface PaginationProps extends Omit<MantinePaginationProps, 'hideWithOnePage'> {
    marginTop?: number;
}

// Round page buttons on cream cards, the current page in brown.
export const Pagination = (props: PaginationProps) => {
    const {marginTop, classNames, ...rest} = props;
    return (
        <Box mt={marginTop === undefined ? 20 : marginTop}>
            <MantinePagination
                hideWithOnePage
                classNames={{
                    control: classes.control,
                    dots: classes.dots,
                    ...(classNames && typeof classNames === 'object' ? classNames : {}),
                }}
                {...rest}
            />
        </Box>
    );
};
