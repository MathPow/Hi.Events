import {CapacityAssignment, IdParam} from "../../../types";
import {ActionIcon, Button, UnstyledButton} from "@mantine/core";
import {t, Trans} from "@lingui/macro";
import {IconDotsVertical, IconHelp, IconPencil, IconPlus, IconTrash, IconUsersGroup} from "@tabler/icons-react";
import {NoResultsSplash} from "../NoResultsSplash";
import classes from './CapacityAssignmentList.module.scss';
import {Popover} from "../Popover";
import {useState} from "react";
import {ActionMenu} from "../ActionMenu";
import {useDisclosure} from "@mantine/hooks";
import {EditCapacityAssignmentModal} from "../../modals/EditCapacityAssignmentModal";
import {useDeleteCapacityAssignment} from "../../../mutations/useDeleteCapacityAssignment";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {StatusTag} from "../StatusTag";
import {formatNumber} from "../../../utilites/helpers.ts";

interface CapacityAssignmentListProps {
    capacityAssignments: CapacityAssignment[];
    openCreateModal: () => void;
}

// The shared capacities as cream cards: name and state, the tickets drawing from it, and how full
// it is (yellow from 80%, red when full).
export const CapacityAssignmentList = ({capacityAssignments, openCreateModal}: CapacityAssignmentListProps) => {
    const [editModalOpen, {open: openEditModal, close: closeEditModal}] = useDisclosure(false);
    const [selectedCapacityAssignmentId, setSelectedCapacityAssignmentId] = useState<IdParam>();
    const deleteMutation = useDeleteCapacityAssignment();

    const handleDeleteProduct = (capacityAssignmentId: IdParam, eventId: IdParam) => {
        deleteMutation.mutate({capacityAssignmentId, eventId}, {
            onSuccess: () => {
                showSuccess(t`Capacity Assignment deleted successfully`);
            },
            onError: (error: any) => {
                showError(error.message);
            }
        });
    }

    if (capacityAssignments.length === 0) {
        return (
            <NoResultsSplash
                heading={t`No Capacity Assignments`}
                icon="billet"
                subHeading={(
                    <Trans>
                        <p>
                            Set a single total attendance limit that applies to multiple ticket types at once.
                        </p>
                        <p>
                            For example, if you link a <b>Day Pass</b> and a <b>Full Weekend</b> ticket, they will both draw from the same pool of spots. Once the limit is reached, all linked tickets automatically stop selling.
                        </p>
                    </Trans>
                )}
            >
                <Button leftSection={<IconPlus size={20}/>} onClick={() => openCreateModal()}>
                    {t({message: 'Create Capacity Assignment', context: 'capacity page'})}
                </Button>
            </NoResultsSplash>
        );
    }

    return (
        <>
            <div className={classes.capacityAssignmentList}>
                {capacityAssignments.map((assignment) => {
                    const percentage = assignment.capacity
                        ? Math.min(100, (assignment.used_capacity / assignment.capacity) * 100)
                        : 0;
                    const level = percentage >= 100 ? 'full' : percentage >= 80 ? 'low' : undefined;

                    return (
                        <article className={classes.card} key={assignment.id}>
                            <div className={classes.head}>
                                <span className={classes.pastille} aria-hidden>
                                    <IconUsersGroup size={20} stroke={2}/>
                                </span>
                                <div className={classes.titleBlock}>
                                    <h2 className={classes.name}>{assignment.name}</h2>
                                    <div className={classes.meta}>
                                        <StatusTag tone={assignment.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                                            {assignment.status === 'ACTIVE' ? t`Active` : t`Inactive`}
                                        </StatusTag>
                                        {!!assignment.products?.length && (
                                            <Popover
                                                title={assignment.products.map((product) => (
                                                    <div key={product.id}>
                                                        {product.title}
                                                    </div>
                                                ))}
                                                position={'bottom'}
                                                withArrow
                                            >
                                                <UnstyledButton className={classes.products}>
                                                    {assignment.products.length > 1
                                                        ? <Trans>Applies to {assignment.products.length} products</Trans>
                                                        : t`Applies to 1 product`}
                                                    <IconHelp size={16}/>
                                                </UnstyledButton>
                                            </Popover>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={classes.capacity}>
                                <div className={classes.count}>
                                    <span className={classes.countValue}>{formatNumber(assignment.used_capacity)}</span>
                                    <span className={classes.countTotal}>
                                        / {assignment.capacity ? formatNumber(assignment.capacity) : '∞'}
                                    </span>
                                    <span className={classes.countLabel}>
                                        {t({message: 'spots taken', context: 'capacity assignment count'})}
                                    </span>
                                </div>
                                {!!assignment.capacity && (
                                    <span
                                        className={classes.bar}
                                        data-level={level}
                                        role="progressbar"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={Math.round(percentage)}
                                    >
                                        <span style={{width: `${percentage}%`}}/>
                                    </span>
                                )}
                            </div>

                            <div className={classes.actions}>
                                <Button
                                    variant="outline"
                                    className={classes.editButton}
                                    leftSection={<IconPencil size={18}/>}
                                    onClick={() => {
                                        setSelectedCapacityAssignmentId(assignment.id as IdParam);
                                        openEditModal();
                                    }}
                                >
                                    {t({message: 'Edit Capacity', context: 'capacity page'})}
                                </Button>
                                <ActionMenu
                                    target={(
                                        <ActionIcon variant="subtle" className={classes.roundButton} aria-label={t`Actions`}>
                                            <IconDotsVertical size={20}/>
                                        </ActionIcon>
                                    )}
                                    itemsGroups={[
                                        {
                                            label: t`Manage`,
                                            items: [
                                                {
                                                    label: t`Edit Capacity`,
                                                    icon: <IconPencil size={14}/>,
                                                    onClick: () => {
                                                        setSelectedCapacityAssignmentId(assignment.id as IdParam);
                                                        openEditModal();
                                                    }
                                                },
                                            ],
                                        },
                                        {
                                            label: t`Danger zone`,
                                            items: [
                                                {
                                                    label: t`Delete Capacity`,
                                                    icon: <IconTrash size={14}/>,
                                                    onClick: () => {
                                                        confirmationDialog(
                                                            t`Are you sure you would like to delete this Capacity Assignment?`,
                                                            () => {
                                                                handleDeleteProduct(
                                                                    assignment.id as IdParam,
                                                                    assignment.event_id as IdParam,
                                                                );
                                                            })
                                                    },
                                                    color: 'red',
                                                },
                                            ],
                                        },
                                    ]}
                                />
                            </div>
                        </article>
                    );
                })}
            </div>
            {(editModalOpen && selectedCapacityAssignmentId)
                && <EditCapacityAssignmentModal onClose={closeEditModal}
                                                capacityAssignmentId={selectedCapacityAssignmentId}/>}
        </>
    );
};
