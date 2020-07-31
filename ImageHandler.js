const fs = require('fs');

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

class ImageHandler{
	constructor(path){
		this.path = path;
	}
	
	getDirectoryContents(withFileTypes = false){
		var files = fs.readdirSync(this.path, { withFileTypes: withFileTypes });
		for(var i = 0; i < files.length; i++){
			files[i].name = this.path + "/" + files[i].name;
		}
		return files;
	}
	
	getAllFilesInDirectory(){
		var files = this.getDirectoryContents(true);
		var returnFiles = [];
		for(var i = 0; i < files.length; i++){
			if(files[i].isFile()) returnFiles.push(files[i].name);
		}
		return returnFiles;
	}
	
	getRandomFile(){
		var files = this.getAllFilesInDirectory();
		if(files.length == 0) return "";
		var index = getRandomInt(0, files.length);
		return files[index];
	}
	
	deleteFile(file){
		fs.unlinkSync(file);
	}
	
	deleteFolder(folder){
		fs.rmdirSync(folder);
	}
	
	makeFolder(folder){
		try{
			fs.mkdirSync(folder);
		} catch(e){
			if(e.code != 'EEXIST') throw e;
		}
	}
	
	moveFile(oldPath, newPath){
		fs.renameSync(oldPath, newPath);
	}
}

module.exports = ImageHandler;