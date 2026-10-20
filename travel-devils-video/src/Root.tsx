import React from 'react';
import {Composition} from 'remotion';
import {DURATION, TravelDevilsDussehra} from './TravelDevilsDussehra';

export const RemotionRoot: React.FC = () => (
	<Composition id="TravelDevilsDussehra" component={TravelDevilsDussehra} durationInFrames={DURATION} fps={30} width={1080} height={1920} />
);
