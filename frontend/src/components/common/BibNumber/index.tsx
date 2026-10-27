import {t} from "@lingui/macro";
import {Badge, MantineSize} from "@mantine/core";

export const BibNumber = ({bibNumber, size = 'sm'}: { bibNumber?: number | null, size?: MantineSize }) => {
    if (!bibNumber) {
        return null;
    }

    return (
        <Badge variant="outline" color="dark" radius="sm" size={size} style={{flexShrink: 0}}>
            {t`Bib ${bibNumber}`}
        </Badge>
    );
};
