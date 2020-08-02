const Twitter = require('twitter-lite');
const fs = require('fs');
const mime = require('mime-types');
const megabyteSize = 1024*1024;

const logLevels = {
	fatal: 0,
	error: 1,
	warning: 2,
	info: 3,
	debug: 4,
	trace: 5
}

class TwitterWrapper{
	constructor(options){
		this.options = options;
		this.logLevel = "";
		console.log(options);
		if(options.logLevel != "" && options.logLevel != undefined)
			this.logLevel = logLevels[options.logLevel.toLowerCase()];
		if(this.logLevel == "") this.logLevel = logLevels.fatal;
	}
	
	log(message, level){
		if(level == logLevels.fatal){
			console.error(message);
		} else if(this.options.logLevel <= level){
			console.log(message);
		}
	}
	
	getTwitterConnection(){
		if(this.twitterConnection == null){
			var options = this.options;
			options.subdomain = "api";
			options.version = "1.1";
			this.twitterConnection = new Twitter(options);
		}
		
		return this.twitterConnection;
	}
	
	getUploadTwitterConnection(){
		if(this.uploadTwitterConnection == null){
			var options = this.options;
			options.subdomain = "upload";
			this.uploadTwitterConnection = new Twitter(options);
		}
		
		return this.uploadTwitterConnection;
	}
	
	async sendTweet(status, mediaIDs = []){
		//Twitter requires media IDs as a CSV list, not an array, so convert
		var mediaIDsString = "";
		for(var i = 0; i < mediaIDs.length; i++){
			mediaIDsString = mediaIDsString + mediaIDs[i];
			if((i+1) != mediaIDs.length) mediaIDsString = mediaIDsString + ",";
		}
		var options = {
			status: status,
			auto_populate_reply_metadata: true,
			media_ids: mediaIDsString
		};
		this.log("sending tweet...", logLevels.info);
		try{
			return await this.getTwitterConnection().post("statuses/update", options);
		} catch(e){
			throw e;
		}
	}
	
	/*TODO: error handling on:
		size checking - PARTIALLY DONE, ADD CUSTOM ERROR CLASS
		check allowed mime types
	*/
	async uploadImage(file){
		//First, read the file into memory
		var fileData = null;
		try{
			fileData = fs.readFileSync(file);
		} catch(e){
			//Here in case we want to add any handling on it
			throw e;
		}
		//Then, determine MIME type
		var mediaType = mime.lookup(file);
		if(mediaType == false) throw "Unknown MIME type";
		
		//Put the data into a Buffer object for easier access
		var bufferData = Buffer.from(fileData);
		var bufferLength = bufferData.length;
		if(bufferLength > (5*megabyteSize) && mediaType.startsWith("image")){
			throw 'File size too large';
		} else if(bufferLength > (15*megabyteSize)){
			throw 'File size too large';
		}
		
		this.log("initializing...", logLevels.info);
		
		//Call the chunked upload INIT
		var initCommandResponse = null;
		try{
			initCommandResponse = await this.getUploadTwitterConnection().post("media/upload", {
				command: "INIT",
				total_bytes: bufferLength,
				media_type: mediaType
			});
		} catch(e){
			//Here in case we want to add any handling on it
			throw e;
		}
		this.log(initCommandResponse, logLevels.info);
		
		//Calculate the number of chunks to send, then start sending chunks
		var numberOfChunks = Math.ceil(bufferLength / megabyteSize);
		var sizeUploaded = 0;
		for(var i = 0; i < numberOfChunks; i++){
			this.log("Uploading chunk " + (i+1) + " of " + numberOfChunks, logLevels.info);
			//The size of a chunk is 1MB
			var start = i * megabyteSize;
			var end = (i+1) * megabyteSize;
			//If the end is larger than the buffer length, we are on the last chunk so
			//set the end to the end of the buffer
			if(end > bufferLength) end = bufferLength;
			//copy the data to another buffer for storage,so we can base64 it
			var currentBuffer = bufferData.subarray(start, end);
			//Options for APPEND
			var options = {
				command: "APPEND",
				media_id: initCommandResponse.media_id_string,
				media_data: currentBuffer.toString('base64'),
				segment_index: i
			};
			
			//Send chunk to Twitter
			var chunkedResponse = null;
			try{
				chunkedResponse = await this.getUploadTwitterConnection().post("media/upload", options);
			} catch(e){
				//Here in case we want to add any handling on it
				throw e;
			}
			this.log(chunkedResponse, logLevels.info);
			sizeUploaded += currentBuffer.length;
		}
		this.log("Sent size: " + sizeUploaded, logLevels.info);
		this.log("Buffer size: " + bufferLength, logLevels.info);
		this.log("finalizing...", logLevels.info);
		//Send the FINALIZE command, finishing the upload
		var finalizeCommandResponse = null;
		try{
			finalizeCommandResponse = await this.getUploadTwitterConnection().post("media/upload", {
				command: "FINALIZE",
				media_id: initCommandResponse.media_id_string
			});
		} catch(e){
			//Here in case we want to add any handling on it
			throw e;
		}
		this.log(finalizeCommandResponse, logLevels.info);
		return initCommandResponse.media_id_string;
	}
	
	async uploadAllImages(files){
		var toWaitOn = [];
		for(var i = 0; i < files.length; i++){
			toWaitOn.push(this.uploadImage(files[i]));
		}
		
		return Promise.all(toWaitOn);
	}
	
	async uploadImagesAndSendTweet(status, files){
		if(files.length > 4) throw 'Too many images!';
		var mediaIDs = await this.uploadAllImages(files);
		
		//Send the tweet with the media ID; returning so that the error is caught
		try{
			return await this.sendTweet(status, mediaIDs);
		} catch(e){
			throw e;
		}
	}
}

module.exports = TwitterWrapper;