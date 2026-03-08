import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { Link, Stack, Grid, Column, Tag, Tile, ClickableTile } from '@carbon/react';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => void;
}

const AboutInfoCard: React.FC = () => {
    const links = [
        { label: browser.i18n.getMessage('aboutProjectGithub'), url: 'https://github.com/StarlightDaemon/CTRL' },
        { label: browser.i18n.getMessage('aboutProjectReportIssue'), url: 'https://github.com/StarlightDaemon/CTRL/issues' },
        { label: browser.i18n.getMessage('aboutProjectRequestFeature'), url: 'https://github.com/StarlightDaemon/CTRL/discussions' },
    ];

    return (
        <SettingsCard title={browser.i18n.getMessage('aboutProject')} className="h-full">
            <p className="text-[var(--cds-text-secondary)] leading-relaxed mb-6">
                {browser.i18n.getMessage('aboutProjectDescription')}
            </p>
            <Stack gap={4}>
                <ClickableTile
                    href="https://github.com/StarlightDaemon/CTRL"
                    className="h-full flex flex-col p-6"
                >
                    <Stack gap={3}>
                        <h3 className="text-lg font-bold">{browser.i18n.getMessage('aboutProject')}</h3>
                        <p className="text-[var(--cds-text-secondary)] leading-relaxed">
                            {browser.i18n.getMessage('aboutProjectTileDescription')}
                        </p>
                    </Stack>
                </ClickableTile>
                {links.map((link, i) => (
                    <Link
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)] no-underline"
                    >
                        <span className="font-medium">{link.label}</span>
                    </Link>
                ))}
            </Stack>
        </SettingsCard>
    );
};

const AboutFeaturesCard: React.FC = () => {
    const features = [
        { title: browser.i18n.getMessage('aboutFeaturePerformanceTitle'), desc: browser.i18n.getMessage('aboutFeaturePerformanceDescription') },
        { title: browser.i18n.getMessage('aboutFeatureSecureTitle'), desc: browser.i18n.getMessage('aboutFeatureSecureDescription') },
        { title: browser.i18n.getMessage('aboutFeatureGlobalTitle'), desc: browser.i18n.getMessage('aboutFeatureGlobalDescription') },
        { title: browser.i18n.getMessage('aboutFeatureReliableTitle'), desc: browser.i18n.getMessage('aboutFeatureReliableDescription') },
    ];

    return (
        <SettingsCard title={browser.i18n.getMessage('aboutKeyFeatures')} className="h-full">
            <Stack gap={4}>
                {features.map((feat, i) => (
                    <div key={i} className="p-3 bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)]">
                        <div>
                            <h4 className="font-medium text-[var(--cds-text-primary)]">{feat.title}</h4>
                            <p className="text-sm text-[var(--cds-text-secondary)]">{feat.desc}</p>
                        </div>
                    </div>
                ))}
            </Stack>
        </SettingsCard>
    );
};

const AboutFooter: React.FC = () => (
    <div className="text-center text-sm text-[var(--cds-text-secondary)] pt-8 pb-4">
        <p>{browser.i18n.getMessage('aboutLicense')}</p>
        <p className="mt-1">{browser.i18n.getMessage('aboutCopyright')}</p>
    </div>
);

export const AboutTab: React.FC<Props> = () => {
    return (
        <SettingsPageLayout
            title={browser.i18n.getMessage('aboutTitle')}
            description={browser.i18n.getMessage('aboutDescription')}
        >
            <div className="flex flex-col gap-1 mb-6">
                <h1 className="text-2xl font-bold text-[var(--cds-text-primary)]">
                    {browser.i18n.getMessage('aboutTitle')}
                </h1>
                <p className="text-[var(--cds-text-secondary)]">
                    {browser.i18n.getMessage('aboutDescription')}
                </p>
                <div className="mt-2 text-left">
                    <Tag type="blue" size="md">
                        v{chrome.runtime.getManifest().version}
                    </Tag>
                </div>
            </div>

            <Grid className="p-0" narrow>
                <Column sm={4} md={4} lg={8} className="flex flex-col">
                    <AboutInfoCard />
                </Column>
                <Column sm={4} md={4} lg={8} className="flex flex-col">
                    <AboutFeaturesCard />
                </Column>
            </Grid>

            <AboutFooter />
        </SettingsPageLayout>
    );
};
