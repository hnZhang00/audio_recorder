window.addEventListener('load', init, false);

function init() {
	console.log('init')
	window.rec = '';
	window.start = function () {
		console.log('开始录音')
		var rec = new mRecorder({
	    callback:function(){
        rec.start();
        window.rec = rec;
	    }
	  });
	}
	window.stop = function () {
		console.log('停止录音')
		window.rec && window.rec.stop();
	}
	window.show = function () {
		console.log('显示录音')
		if (!window.rec)
			return;
		let url = window.rec.getURL();
		document.querySelector('audio').src = url;
		document.querySelector('#download').href = url;
	}
}
