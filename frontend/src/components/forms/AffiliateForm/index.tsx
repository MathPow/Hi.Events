import {InputGroup} from "../../common/InputGroup";
import {Button, Select, TextInput} from "@mantine/core";
import {t} from "@lingui/macro";
import {UseFormReturnType} from "@mantine/form";
import {CreateAffiliateRequest, UpdateAffiliateRequest} from "../../../api/affiliate.client.ts";
import {CustomSelect, ItemProps} from "../../common/CustomSelect";
import {IconCheck, IconRefresh, IconX} from "@tabler/icons-react";
import {ShowForDesktop, ShowForMobile} from "../../common/Responsive/ShowHideComponents.tsx";
import {useParams} from "react-router";
import {useGetEventPromoCodes} from "../../../queries/useGetEventPromoCodes.ts";

interface AffiliateFormProps {
    form: UseFormReturnType<CreateAffiliateRequest | UpdateAffiliateRequest>;
    isEditing?: boolean;
    existingCode?: string;
    onGenerateCode?: () => void;
}

export const AffiliateForm = ({form, isEditing = false, existingCode, onGenerateCode}: AffiliateFormProps) => {
    const {eventId} = useParams();
    const {data: promoCodes} = useGetEventPromoCodes(eventId, {perPage: 100});
    const promoCodeOptions = (promoCodes?.data || []).map(promoCode => ({
        value: String(promoCode.id),
        label: promoCode.code,
    }));

    const statusOptions: ItemProps[] = [
        {
            icon: <IconCheck/>,
            label: t`Active`,
            value: 'ACTIVE',
            description: t`Affiliate sales will be tracked`,
        },
        {
            icon: <IconX/>,
            label: t`Inactive`,
            value: 'INACTIVE',
            description: t`Affiliate sales will not be tracked. This will deactivate the affiliate.`,
        },
    ];

    return (
        <>
            {!isEditing && (
                <>
                    <TextInput
                        label={t`Code`}
                        placeholder={t`Enter unique affiliate code`}
                        required
                        description={t`This code will be used to track sales. Only letters, numbers, hyphens, and underscores allowed.`}
                        {...form.getInputProps('code')}
                        onChange={(event) => {
                            form.setFieldValue('code', event.target.value.toUpperCase());
                        }}
                        rightSection={(
                            <Button
                                variant="subtle"
                                size="xs"
                                color="gray"
                                onClick={onGenerateCode}
                                style={{fontWeight: 400}}
                                title={t`Generate code`}
                                leftSection={<IconRefresh size={16}/>}
                            >
                                <ShowForMobile>
                                    {t`Generate`}
                                </ShowForMobile>
                                <ShowForDesktop>
                                    {t`Generate code`}
                                </ShowForDesktop>

                            </Button>
                        )}
                        rightSectionWidth={'auto'}
                    />
                </>
            )}

            {isEditing && existingCode && (
                <TextInput
                    label={t`Code`}
                    value={existingCode}
                    disabled
                    description={t`Affiliate code cannot be changed`}
                />
            )}

            <InputGroup>
                <TextInput
                    label={t`Name`}
                    description={t`This will not be visible to customers, but helps you identify the affiliate.`}
                    placeholder={t`Enter affiliate name`}
                    required
                    {...form.getInputProps('name')}
                />

                <TextInput
                    label={t`Email`}
                    description={t`An email to associate with this affiliate. The affiliate will not be notified.`}
                    placeholder={t`Enter affiliate email (optional)`}
                    type="email"
                    {...form.getInputProps('email')}
                />
            </InputGroup>

            <CustomSelect
                label={t`Status`}
                required
                form={form}
                name={'status'}
                optionList={statusOptions}
            />

            <Select
                label={t`Linked promo code`}
                description={t`Optional. The affiliate link will apply this promo code automatically, and orders using it count towards this affiliate on their partner page.`}
                placeholder={t`No promo code`}
                data={promoCodeOptions}
                clearable
                searchable
                {...form.getInputProps('promo_code_id')}
            />
        </>
    );
};
