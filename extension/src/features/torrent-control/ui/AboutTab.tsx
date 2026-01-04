import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { Github, Bug, Lightbulb, ExternalLink, Shield, Zap, Globe, TestTube, Download, BookHeadphones, Info } from 'lucide-react';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { ABBSettings } from '../../../features/audiobook-bay/lib/types';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => void;
    abbSettings: ABBSettings | null;
    updateABBSettings: (newSettings: ABBSettings) => void;
}

const AboutInfoCard: React.FC = () => {
    const links = [
        { icon: Github, label: 'GitHub Repository', url: 'https://github.com/physton/torrent-control' },
        { icon: Bug, label: 'Report an Issue', url: 'https://github.com/physton/torrent-control/issues' },
        { icon: Lightbulb, label: 'Request a Feature', url: 'https://github.com/physton/torrent-control/discussions' },
    ];

    return (
        <SettingsCard title="About">
            <p className="text-text-secondary leading-relaxed mb-6">
                A modern, powerful extension to manage your torrents directly from your browser.
                Built with performance and security in mind, it supports multiple clients,
                drag-and-drop, and seamless context menu integration.
            </p>
            <div className="space-y-3">
                {links.map((link, i) => (
                    <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 rounded-md hover:bg-hover transition-colors group"
                    >
                        <link.icon className="w-5 h-5 text-text-secondary group-hover:text-accent mr-3" />
                        <span className="text-text-primary font-medium">{link.label}</span>
                        <ExternalLink className="w-4 h-4 text-text-secondary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                ))}
            </div>
        </SettingsCard>
    );
};

const AboutFeaturesCard: React.FC = () => {
    const features = [
        { icon: Zap, title: 'High Performance', desc: 'Virtualization for 10k+ torrents' },
        { icon: Shield, title: 'Secure', desc: 'Optional permissions & token storage' },
        { icon: Globe, title: 'Global', desc: 'Zero-touch localization' },
        { icon: TestTube, title: 'Reliable', desc: 'Automated E2E testing' },
    ];

    return (
        <SettingsCard title="Key Features">
            <div className="grid grid-cols-1 gap-4">
                {features.map((feat, i) => (
                    <div key={i} className="flex items-start">
                        <div className="p-2 rounded-lg bg-surface mr-4">
                            <feat.icon className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h4 className="font-medium text-text-primary">{feat.title}</h4>
                            <p className="text-sm text-text-secondary">{feat.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </SettingsCard>
    );
};



const AboutFooter: React.FC = () => (
    <div className="text-center text-sm text-text-secondary pt-8 pb-4">
        <p>Released under the MIT License</p>
        <p className="mt-1">© 2025 CTRL (Torrent Control Reloaded)</p>
    </div>
);

export const AboutTab: React.FC<Props> = (props) => {
    return (
        <SettingsPageLayout
            title="About CTRL"
            description="Version info, links, and diagnostics."
            icon={Info}
        >
            <div className="text-center mb-6">
                <img src="/icon/default-64.png" alt="Logo" className="w-24 h-24 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-text-primary">CTRL</h2>
                <p className="text-text-secondary text-lg">Torrent Control Reloaded</p>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                    v{chrome.runtime.getManifest().version}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AboutInfoCard />
                <AboutFeaturesCard />
            </div>



            <AboutFooter />
        </SettingsPageLayout>
    );
};
