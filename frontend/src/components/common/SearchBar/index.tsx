import {TextInput, TextInputProps, UnstyledButton} from '@mantine/core';
import {IconX} from '@tabler/icons-react';
import classes from './SearchBar.module.scss';
import {useEffect, useState} from "react";
import {SortSelector, SortSelectorProps} from "../SortSelector";
import {t} from "@lingui/macro";
import classNames from "classnames";
import {PaginationData, QueryFilters} from "../../../types.ts";
import {PublicIcon} from "../PublicIcon";

interface SearchBarProps extends TextInputProps {
    onClear: () => void;
    sortProps?: SortSelectorProps | undefined,
}

interface SearchBarWrapperProps {
    placeholder?: string,
    setSearchParams: (updates: Partial<QueryFilters>) => void,
    searchParams: Partial<QueryFilters>,
    pagination?: PaginationData,
}

export const SearchBarWrapper = ({setSearchParams, searchParams, pagination, placeholder}: SearchBarWrapperProps) => {
    return (
        <SearchBar
            value={searchParams.query}
            onChange={(event) => {
                setSearchParams({
                    query: event.target.value,
                    pageNumber: 1,
                });
            }}
            onClear={() => setSearchParams({
                query: '',
                pageNumber: 1,
            })}
            placeholder={placeholder || t`Search...`}
            sortProps={pagination ? {
                selected: searchParams.sortBy && searchParams.sortDirection
                    ? searchParams.sortBy + ':' + searchParams.sortDirection
                    : pagination?.default_sort + ':' + pagination?.default_sort_direction,
                options: pagination?.allowed_sorts,
                onSortSelect: (key, sortDirection) => {
                    setSearchParams({
                        sortBy: key,
                        sortDirection: sortDirection,
                    })
                },
            } : undefined}
        />
    );
}

// The floating search field of the organizer's events page, with the sort menu beside it.
export const SearchBar = ({sortProps, onClear, value, onChange, ...props}: SearchBarProps) => {
    const [searchValue, setSearchValue] = useState<typeof value>(value);

    useEffect(() => {
        setSearchValue(value);
    }, [value])

    return (
        <div className={classNames(classes.searchBarWrapper, props.className)}>
            <div className={classes.shadow}>
                <TextInput
                    className={classes.searchBar}
                    classNames={{input: classes.input, section: classes.section}}
                    leftSection={<PublicIcon name={'recherche'} size={20}/>}
                    leftSectionPointerEvents="none"
                    size="md"
                    value={searchValue}
                    aria-label={typeof props.placeholder === 'string' ? props.placeholder : undefined}
                    {...props}
                    onChange={(event) => {
                        setSearchValue(event.currentTarget.value);
                        if (onChange) {
                            onChange(event);
                        }
                    }}
                    rightSection={value ? (
                        <UnstyledButton className={classes.clear} onClick={() => onClear()}
                                        aria-label={t`Clear Search Text`}>
                            <IconX size={18} stroke={2}/>
                        </UnstyledButton>
                    ) : null}
                />
            </div>

            {sortProps
                && <SortSelector
                    selected={sortProps.selected}
                    options={sortProps.options}
                    onSortSelect={sortProps.onSortSelect}/>
            }
        </div>
    );
};
