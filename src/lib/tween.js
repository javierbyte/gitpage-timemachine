function easeInOutQuad(t) {
	return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

function Tween(config, cb) {
	const time = config.time;
	const start = config.start || 0;
	const end = config.end || 1;

	let initialTime = new Date().getTime();

	function tweenCb() {
		const elapsed = new Date().getTime() - initialTime;

		if (elapsed < time) {
			window.requestAnimationFrame(tweenCb);
		}

		const progress = easeInOutQuad(elapsed / time) * (end - start) + start;

		cb(progress);
	}

	window.requestAnimationFrame(tweenCb);
}

export default Tween;
