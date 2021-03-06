'use strict';
var router = require('express').Router();
module.exports = router;
var _ = require('lodash');
var mongoose = require('mongoose');
var Pipeline = mongoose.model('Pipeline')
var User = mongoose.model('User');
var run = require('../../modules/dockerun');
var uuid = require('node-uuid');
var request = require('request-promise');
var Promise = require('bluebird');
Promise.promisifyAll(mongoose);
var cleanup = require('../../modules/dockercleanup');
var chalk = require('chalk');
var path = require('path');

var ensureAuthenticated = function(req, res, next) {
	if (req.isAuthenticated()) {
		next();
	} else {
		res.status(401).end();
	}
};

router.get('/validate', ensureAuthenticated, function(req, res, next) {
	console.log(req.query);
	request({
		url: req.query.url,
		headers: {
			'User-Agent': 'Pied Pipeline',
			'Authorization': 'token ' + req.user.github.token
		}
	})
	.then(function(response) {
		res.json(JSON.parse(response))
	})
	.catch(next);
})

router.get('/pipeStatus/:pipelineId/:imgId',function(req,res,next){
	//REFACTOR
	Pipeline.findById(req.params.pipelineId)
	.exec()
	.then(function(pipeline){
		var built = false;
		
		res.send(_.result(_.find(pipeline.pipeline,'imageId',req.params.imgId),'built'));
	})
})

router.delete('/:id', ensureAuthenticated, function(req, res, next) {
	cleanup.deletePipelineImages(req.params.id)
	.then(function() {
		return Pipeline.findByIdAndRemove(req.params.id)
		.exec()
		.then(function() {
			return User.findById(req.user._id)
			.exec()
						// Throw error?
					})
		.then(null, function(err) {
			err.customMessage = "There was a problem finding the User";
			err.status = 911;
			next(err);
		})
	})
	.then(null, function(err) {
		err.customMessage = "There was a problem deleting the pipeline images";
		err.status = 911;
		next(err);
	})
	.then(function(user) {
		user.pipelines = user.pipelines.filter(function(id) {
			return id.toString() !== req.params.id;
		})
		return user;
	})
	.then(null, function(err) {
		err.customMessage = "There was a problem removing the pipeline from the user";
		err.status = 911;
		next(err);
	})
	.then(function(user) {
		return user.saveAsync()
		.then(function(user) {
			res.json(user);
		})
	})
	.then(null, function(err) {
		err.customMessage = "There was a problem saving the user";
		err.status = 911;
		next(err);
	})
})

router.get('/', ensureAuthenticated, function(req, res, next) {
	if (req.query.user) {
		request({
				url: `https://api.github.com/repos/${req.query.user}/${req.query.repo}`,
				headers: {
					'User-Agent': 'Pied Pipeline',
					'Authorization': 'token ' + req.user.github.token
				}
			})
		.then(function(response) {
			res.json(JSON.parse(response))
		})
		.catch(function(err) {
			err.customMessage = "There was a problem getting the user";
			next(err);
		});
	} else {
		User.findById(req.user._id)
		.populate('pipelines')
		.exec()
		.then(function(user) {
			res.json(user);
		})
		.then(null, function(err) {
			err.customMessage = "There was a problem finding the user";
			next(err);
		})
	}
})

router.put('/', ensureAuthenticated, function(req, res, next) {
	Pipeline.findById(req.body.id)
	.exec()
	.then(function(pipeline) {
		var newPipe = {
			name: req.body.repo.name,
			gitUrl: req.body.repo.html_url,
			description: req.body.repo.description,
			order: pipeline.pipeline.length,
			imageId: uuid.v4()
		};
		res.send({pipelineId: req.body.id,imgId: newPipe.imageId});
		pipeline.pipeline.push(newPipe);
		// console.log('new pipe pushed', pipeline);
		return new Promise(function(resolve, reject){
			pipeline.save(function(err, updatedPipeline) {
				if (err) reject(err);
				// console.log("NEW PIPE IN PUT ROUTE: \n", newPipe, "\n")
				run.getRepository(newPipe.gitUrl, updatedPipeline._id, req.user.github.token)
				.then(function() {
					console.log('Here is your image iddd!!!!!', newPipe.imageId);
					console.log(chalk.blue("Ran get repository, about to build image! :)"));
					var targetDir = path.join(__dirname, '../../../../downloads');
					return run.buildImage(newPipe.imageId, targetDir, newPipe.gitUrl);
				})
				.then(function() {
					console.log(chalk.blue("sending updated pipeline"));
					return Pipeline.findById(req.body.id).exec();
				})
				.then(function(pipeline){
					pipeline.pipeline.forEach(function(pipe){
						if(pipe.imageId===newPipe.imageId)
							pipe.built=true;
					})
					pipeline.save(function(err, result){
						if (err) reject (err);
						else resolve(result);
					});
				})
				.catch(reject);
			});
		});
	})
	.then(null, next);
})


router.post('/', ensureAuthenticated, function(req, res, next) {
	var pipelineId;
	Pipeline.create({
		user: req.user._id,
		name: req.body.name
	})
	.then(function(pipeline) {
		pipelineId = pipeline._id;
		return pipeline
	})
	.then(function() {
		return User.findById(req.user._id)
		.exec();
	})
	.then(null, function(err) {
		err.customMessage = "There was a problem finding the User";
		next(err);
	})
	.then(function(user) {
		user.pipelines.unshift(pipelineId);
		user.save(function(err, savedUser) {
			return User.findById(req.user._id)
			.populate('pipelines')
			.exec()
			.then(function(user) {
				res.json(user);
			})
		})
	})
	.then(null, function(err) {
		err.customMessage = "There was a problem removing a pipe from the pipeline";
		next(err);
	})
});