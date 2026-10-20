import classes from './Table.module.scss'
import React, {useRef} from "react";
import {Card} from "../Card";
import {Table as MantineTable} from "@mantine/core";
import {useStackedTableLabels} from "../../../hooks/useStackedTableLabels.ts";

interface TableHeadProps {
    children: React.ReactNode;
}

export const TableHead = ({children}: TableHeadProps) => {
    return (
        <MantineTable.Thead className={classes.tableHead}>
        {children}
        </MantineTable.Thead>
    )
}

 interface TableProps {
    children: React.ReactNode;
}

export const Table =({children}: TableProps) => {
    const tableRef = useRef<HTMLTableElement>(null);
    useStackedTableLabels(tableRef);

    return (
        <Card className={classes.card}>
            <MantineTable.ScrollContainer minWidth={200}>
                <MantineTable className={classes.table} ref={tableRef}>
                    {children}
                </MantineTable>
            </MantineTable.ScrollContainer>
        </Card>
    );
}
