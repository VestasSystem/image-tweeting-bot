const ImageHandler = require('./ImageHandler');
const TwitterWrapper = require('./TwitterWrapper');
const fs = require('fs');
const cron = require('node-cron');

//Wrapper function to catch errors
function uploadImages(context){
	context.uploadImages().catch(console.error);
}

class ImageTweetingBot{
	constructor(configFile, schedule){
		//Get the config info
		var configs = JSON.parse(fs.readFileSync(configFile, 'utf8'));
		//Load from the config
		this.statusToSend = configs.statusToSend;
		if(this.statusToSend == "") this.statusToSend = " ";
		this.imageHandler = new ImageHandler(configs.imagePath);
		if(configs.imagePath != ""){
			this.imageHandler.makeFolder(configs.imagePath);
		}
		this.numberToUpload = configs.numberToUpload;
		this.alreadySentPath = configs.alreadySentPath;
		if(this.alreadySentPath != ""){
			this.imageHandler.makeFolder(this.alreadySentPath);
		}
		this.retweetImages = configs.retweetImages;

		this.useStatus = config.useStatus;
		if(this.useStatus){
			var statusFile = config.statusFile;
			var statusContents = fs.readFileSync(configFile, 'utf8');
			if(statusContents == "") this.useStatus = false;
			else{
				this.statuses = JSON.parse(statusContents);
				this.numberToUpload = 1;
			}
		}
		
		//create the Twitter Wrapper
		this.twitterWrapper = new TwitterWrapper({
			consumer_key: configs.consumerKey,
			consumer_secret: configs.consumerSecret,
			access_token_key: configs.accessTokenKey,
			access_token_secret: configs.accessTokenSecret,
			logLevel: configs.logLevel
		});
		
		//Handle if we are scheduling
		if(schedule && configs.schedule != ""){
			this.scheduleTask = cron.schedule(configs.schedule, uploadImages.bind(null, this), { scheduled: false });
			if(this.scheduleTask) this.scheduled = true;
			else this.scheduled = false;
		} else this.scheduled = false;
	}
	
	start(){
		if(!this.scheduled) return;
		this.scheduleTask.start();
	}
	
	stop(){
		if(!this.scheduled) return;
		this.scheduleTask.stop();
	}
	
	getFiles(){
		var filesToUpload = [];
		for(var i = 0; i < this.numberToUpload; i++){
			var file = this.imageHandler.getRandomFile();
			if(file == "") break;
			filesToUpload.push(file);
		}
		return filesToUpload;
	}
	
	/* TODO: Add proper error handling
	*/
	async uploadImages(){
		var filesToUpload = this.getFiles();
		
		//If there are no more files, rename the backup folder to the main folder,
		//check if there are now files, and throw if not. If there are, get the
		//required number of files
		if(filesToUpload.length == 0){
			if(this.retweetImages){
				this.imageHandler.deleteFolder(this.imageHandler.path);
				this.imageHandler.moveFile(this.alreadySentPath, this.imageHandler.path);
				this.imageHandler.makeFolder(this.alreadySentPath);
				filesToUpload = this.getFiles();
			}
			if(filesToUpload.length == 0) throw 'No more images';
		}

		var status = this.statusToSend;
		if(this.useStatus) status = this.statuses[filesToUpload[1]];
		
		//Upload the file
		try{
			await this.twitterWrapper.uploadImagesAndSendTweet(status, filesToUpload);
		} catch(e){
			throw e;
		}
		
		//
		for(var i = 0; i < filesToUpload.length; i++){
			var filename = filesToUpload[i].substring(filesToUpload[i].lastIndexOf("/")+1);
			this.imageHandler.moveFile(filesToUpload[i], this.alreadySentPath + "/" + filename);
		}
	}
}

module.exports = ImageTweetingBot;