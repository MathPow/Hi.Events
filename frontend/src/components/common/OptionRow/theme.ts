import {MultiSelect, Select} from "@mantine/core";
import {optionRowClasses, renderOptionRow} from "./index.tsx";

// The lists of the whole app (MantineProvider, App.tsx): their options are OptionRow, like the filter
// menus. A list that brings its own renderOption keeps it.
export const optionRowTheme = {
    Select: Select.extend({
        defaultProps: {renderOption: renderOptionRow, withCheckIcon: false},
        classNames: {option: optionRowClasses.option},
    }),
    MultiSelect: MultiSelect.extend({
        defaultProps: {renderOption: renderOptionRow, withCheckIcon: false},
        classNames: {option: optionRowClasses.option},
    }),
};
