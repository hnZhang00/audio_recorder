
var _log = function (msg) {
	switch(msg) {
		case 'PermissionDeniedError':
		case 'NotFoundError':
		case 'AbortError':
		case 'NotAllowedError':
		case 'NotReadableError':
		case 'OverConstrainedError':
			msg = '您的浏览器禁止了麦克风，请点击地址栏左侧叹号，找到麦克风，选择“在此网站上始终允许”。';
			break;
		case 'SecurityError':
			msg = '在getUserMedia() 被调用的 Document 上面，使用设备媒体被禁止。';
			break;
		case 'TypeError':
			msg = 'constraints对象未设置［空］，或者都被设置为false。';
			break;
	}
  alert(msg)
};

var mRecorder = function (opt) {
  var opt = opt || {};
  opt.mediaType = opt.mediaType || 'mp3';
  // 处理基础 API 兼容性
  window.URL = window.URL || window.webkitURL;
  window.AudioContext = window.AudioContext || window.webkitAudioContext || function(){};
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  // AudioContext 支持C35、Edge、F25、O22，C10、O15、S6需要webkit前缀。

  var recStatus = 0; // 1 正在录音，0 未在录音
  // 创建音频上下文
  var context = new AudioContext;
  var audioData = {
    size: 0,  //录音文件长度
    buffer: [], //录音缓存
    inputSampleRate: context.sampleRate,  //输入采样率
    inputSampleBits: 16,  // 输入采样数位 8, 16
    outputSampleRate: 44100/6,  // 输出采样率
    oututSampleBits: 8, // 输出采样数位 8, 16
    input: function (data) {
      this.buffer.push(new Float32Array(data));
      this.size += data.length;
    },
    compress: function () {
      //合并
      var data = new Float32Array(this.size);
      var offset = 0;
      for (var i = 0; i < this.buffer.length; i++) {
        data.set(this.buffer[i], offset);
        offset += this.buffer[i].length;
      }
      //压缩
      var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
      var length = data.length / compression;
      var result = new Float32Array(length);
      var index = 0, j = 0;
      while (index < length) {
        result[index] = data[j];
        j += compression;
        index++;
      }
      return result;
    },
    encodeAudio: function () {
      var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
      var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
      var bytes = this.compress();
      var dataLength = bytes.length * (sampleBits / 8);
      var buffer = new ArrayBuffer(44 + dataLength);
      var data = new DataView(buffer);
       
      var channelCount = 1;//单声道
      var offset = 0;
       
      var writeString = function (str) {
        for (var i = 0; i < str.length; i++) {
          data.setUint8(offset + i, str.charCodeAt(i));
        }
      }
       
      // 资源交换文件标识符
      writeString('RIFF'); offset += 4;
      // 下个地址开始到文件尾总字节数,即文件大小-8
      data.setUint32(offset, 36 + dataLength, true); offset += 4;
      // WAV文件标志
      writeString('WAVE'); offset += 4;
      // 波形格式标志
      writeString('fmt '); offset += 4;
      // 过滤字节,一般为 0x10 = 16
      data.setUint32(offset, 16, true); offset += 4;
      // 格式类别 (PCM形式采样数据)
      data.setUint16(offset, 1, true); offset += 2;
      // 通道数
      data.setUint16(offset, channelCount, true); offset += 2;
      // 采样率,每秒样本数,表示每个通道的播放速度
      data.setUint32(offset, sampleRate, true); offset += 4;
      // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8
      data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true); offset += 4;
      // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8
      data.setUint16(offset, channelCount * (sampleBits / 8), true); offset += 2;
      // 每样本数据位数
      data.setUint16(offset, sampleBits, true); offset += 2;
      // 数据标识符
      writeString('data'); offset += 4;
      // 采样数据总数,即数据总大小-44
      data.setUint32(offset, dataLength, true); offset += 4;
      // 写入采样数据
      if (sampleBits === 8) {
        for (var i = 0; i < bytes.length; i++, offset++) {
          var s = Math.max(-1, Math.min(1, bytes[i]));
          var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
          val = parseInt(255 / (65535 / (val + 32768)));
          data.setInt8(offset, val, true);
        }
      } else {
        for (var i = 0; i < bytes.length; i++, offset += 2) {
          var s = Math.max(-1, Math.min(1, bytes[i]));
          data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
      }
       
      return new Blob([data], { type: 'audio/' + (opt.mediaType) });
    }
  }

  var self = this;

  // 公共属性和方法
  var _init = function(stream){
    // 创建音频源
    var source = context.createMediaStreamSource(stream);
    // 创建效果节点
    // 旧版方法 createJavaScriptNode
    var node = context.createScriptProcessor(4096, 1, 1);
     
    //开始录音
    self.start = function () {
      audioData.buffer = []; // 清空录音缓存
      audioData.size = 0;
      source.connect(node);
      node.connect(context.destination);
      recStatus = 1;
    };
    
    //停止
    self.stop = function () {
      node.disconnect();
      recStatus = 0;
    };
    
    //获取音频文件
    self.getBlob = function () {
      if(recStatus == 1)
      	self.stop();
      return audioData.encodeAudio();
    };

    // 获取音频文件的URL
    self.getURL = function () {
      if(recStatus == 1)
      	self.stop();
      return window.URL.createObjectURL(self.getBlob());
    };
    
    //上传
    self.upload = function (params) {
      var sucessCallback = params.sucessCallback || function(){}
      var errorCallback = params.errorCallback || function(){}

      var form = new FormData();
      var xhr = new XMLHttpRequest();
      // 将 Blob 对象转换为 File 对象，解决项目中后台不识别 Blob 的问题
      var file = new window.File([self.getBlob()], new Date().getTime()+'.mp3', {type: 'mp3'});
      console.log('file', file)
      try {
        form.append('type', 'voice');
        form.append('Content-Type', 'multipart/form-data');
        form.append('media', file);
        // form.append('media', self.getBlob());
      } catch (err) {
        errorCallback(err);
        console.log(err)
        return;
      }

      xhr.onreadystatechange = function() {
        if (xhr.readyState < 4) {
          errorCallback();
          return;
        }
        if (xhr.status > 400) {
          errorCallback({ status: xhr.status });
          return;
        }
        var res = JSON.parse(xhr.responseText) || {};
        var mediaId = res.mediaId || '';
        if(!mediaId) {
          errorCallback();
        } else {
          sucessCallback(mediaId);
        }
      };

      xhr.onerror = function() {
        var err = JSON.parse(xhr.responseText);
        err.status = xhr.status;
        err.statusText = xhr.statusText;
        errorCallback(err);
      };

      xhr.open('POST', params.url, true);
      xhr.send(form);
    };
    
    //音频采集
    node.onaudioprocess = function (e) {
      audioData.input(e.inputBuffer.getChannelData(0));
    };
  };

  // navigator.mediaDevices.getUserMedia
  // C47、F36、O、Edge
  // IE S不支持
  // 移动端只有FM36支持

  // navigator.getUserMedia
  // O12、Edge
  // C21、O18 需要webkit前缀
  // F17需要moz前缀
  // IE S不支持
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && AudioContext) {
    navigator.mediaDevices.getUserMedia({
      audio: true
    }).then(function(stream) {
      _init(stream);
      opt.callback && opt.callback();
    }).catch(function(err) {
      _log(err.name || err.message);
    });
    return;
  }

  if (navigator.getUserMedia && AudioContext) {
    navigator.getUserMedia({
      audio: true
    }, function (stream) {
      _init(stream);
      opt.callback && opt.callback();
    }, function (err) {
      _log(err.name || err.message);
    });
    return;
  }

  _log('浏览器不支持录音功能。');
};