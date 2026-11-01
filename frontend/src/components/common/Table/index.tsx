import classes from './Table.module.scss'
import React, {useRef} from "react";
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

// A list in a cream card, like « Commandes récentes » on the organizer dashboard: a pale header row,
// rows separated by a thin line; on phones each row becomes a stacked card (stacked-table mixin).
export const Table =({children}: TableProps) => {
    const tableRef = useRef<HTMLTableElement>(null);
    useStackedTableLabels(tableRef);

    return (
        <div className={classes.card}>
            <MantineTable.ScrollContainer minWidth={200}>
                <MantineTable className={classes.table} ref={tableRef} highlightOnHover>
                    {children}
                </MantineTable>
            </MantineTable.ScrollContainer>
        </div>
    );
}
