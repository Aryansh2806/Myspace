import {continueRender, delayRender, staticFile} from 'remotion';

export const fontFamily = 'Poppins';

const handle = delayRender('Loading Poppins');
Promise.all(
	[500, 600, 700, 800, 900].map((w) => {
		const face = new FontFace(fontFamily, `url(${staticFile(`fonts/Poppins-${w}.ttf`)})`, {weight: String(w)});
		document.fonts.add(face);
		return face.load();
	}),
).then(() => continueRender(handle));
