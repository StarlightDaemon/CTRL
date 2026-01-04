
export interface TorrentMetadata {
    resolution: '4K' | '1080p' | '720p' | '480p' | 'SD' | null;
    codec: 'x265' | 'x264' | 'AV1' | 'XviD' | null;
    audio: 'Dual Audio' | 'Atmos' | '5.1' | null;
    group: string | null;
}

export const parseResolution = (title: string): TorrentMetadata['resolution'] => {
    const t = title.toLowerCase();
    if (t.match(/2160p|4k|uhd/)) return '4K';
    if (t.match(/1080p|full.?hd/)) return '1080p';
    if (t.match(/720p|hd(?!.?rip)/)) return '720p';
    if (t.match(/480p|sd/)) return '480p';
    return null;
};

export const parseCodec = (title: string): TorrentMetadata['codec'] => {
    const t = title.toLowerCase();
    if (t.match(/x265|hevc|h\.?265/)) return 'x265';
    if (t.match(/x264|h\.?264/)) return 'x264';
    if (t.match(/av1/)) return 'AV1';
    if (t.match(/xvid|divx/)) return 'XviD';
    return null;
};

export const extractMetadata = (title: string): TorrentMetadata => {
    return {
        resolution: parseResolution(title),
        codec: parseCodec(title),
        audio: title.match(/dual.?audio/i) ? 'Dual Audio' : title.match(/atmos/i) ? 'Atmos' : null,
        group: title.match(/-([A-Za-z0-9]+)$/)?.[1] || null
    };
};
