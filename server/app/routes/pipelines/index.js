'use strict';
var router = require('express').Router();
module.exports = router;
var _ = require('lodash');
var mongoose = require('mongoose');
var Pipeline = mongoose.model('Pipeline')
var User = mongoose.model('User');

var ensureAuthenticated = function(req, res, next) {
	if (req.isAuthenticated()) {
		next();
	} else {
		res.status(401).end();
	}
};


router.get('/', ensureAuthenticated, function(req, res, next) {
	User.findById(req.user._id)
	.populate('pipelines')
	.exec()
	.then(function(user) {
		res.json(user);
	})
	.then(null, next)
})


router.put('/', ensureAuthenticated, function(req, res, next) {
	Pipeline.findById(req.body.id)
	.exec()
	.then(function(pipeline) {
		pipeline.pipeline.push({
			name: req.body.repo.name,
			gitUrl: req.body.repo.html_url,
			description: req.body.repo.description,
			order: pipeline.pipeline.length
		});
		console.log(pipeline);
		pipeline.save(function(err, updatedPipeline) {
			res.json(updatedPipeline);
		})
	})
})


router.post('/', ensureAuthenticated, function (req, res) {
	var pipelineId;
	Pipeline.create({
		user: req.user._id,
		name: req.body.name
	})
	.then(function (pipeline) {
		pipelineId = pipeline._id;
		return User.findById(req.user._id)
		.exec();
	})
	.then(function (user) {
		user.pipelines.push(pipelineId);
		user.save(function (err, savedUser) {
			// res.json(savedUser);
			return User.findById(req.user._id)
			.populate('pipelines')
			.exec()
			.then(function(user) {
				res.json(user);
			})
		})
	})
});