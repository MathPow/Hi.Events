import {SocialMediaLayoutEntry} from "../types.ts";

export interface SocialHandle {
    platform: string;
    handle: string;
}

// Same rule as OrganizerSettingDomainObject::getVisibleSocialMediaHandles: the order chosen on « Ma page »,
// without the hidden links; handles missing from the layout (added since, in Settings) follow.
export const visibleSocialHandles = (
    handles?: Record<string, string | undefined> | null,
    layout?: SocialMediaLayoutEntry[] | null,
): SocialHandle[] => {
    const filled = Object.entries(handles ?? {})
        .filter((entry): entry is [string, string] => !!entry[1]?.trim());
    const byPlatform = new Map(filled);
    const placed = new Set<string>();
    const result: SocialHandle[] = [];

    (layout ?? []).forEach(({platform, visible}) => {
        if (!byPlatform.has(platform) || placed.has(platform)) {
            return;
        }
        placed.add(platform);
        if (visible) {
            result.push({platform, handle: byPlatform.get(platform) as string});
        }
    });

    filled.forEach(([platform, handle]) => {
        if (!placed.has(platform)) {
            result.push({platform, handle});
        }
    });

    return result;
};
