import {Skeleton} from "@mantine/core";
import classes from "./TableSkeleton.module.scss";

interface TableSkeletonProps {
    isVisible: boolean,
    numRows?: number,  // numRows is optional
}

// The shape of a table card while its rows load.
export const TableSkeleton = ({isVisible, numRows = 15}: TableSkeletonProps) => {
    if (!isVisible) {
        return null;
    }

    return (
        <div className={classes.card}>
            <Skeleton height={40} radius={12} mb={18}/>
            {[...Array(numRows)].map((_, index: number) => (
                <Skeleton key={index} height={18} radius={9} mb={22} width={index % 3 === 2 ? '70%' : '100%'}/>
            ))}
        </div>
    )
}
