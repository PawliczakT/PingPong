import {Platform} from 'react-native';

export default function WebAnalytics() {
    if (Platform.OS !== 'web') {
        return null;
    }

    const {Analytics} = require('@vercel/analytics/react');
    const {SpeedInsights} = require('@vercel/speed-insights/react');

    return (
        <>
            <Analytics/>
            <SpeedInsights/>
        </>
    );
}
