function easeInOutQuad(t) {
	return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

function Tween(time, cb) {
	let initialTime = new Date().getTime();

	function tweenCb() {
		const elapsed = new Date().getTime() - initialTime;

		if (elapsed < time) {
			window.requestAnimationFrame(tweenCb);
		}

		cb(easeInOutQuad(Math.min(elapsed / time, 1)));
	}

	window.requestAnimationFrame(tweenCb);
}

module.exports = Tween;
