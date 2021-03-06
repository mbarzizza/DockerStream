app.config(function($stateProvider) {

    $stateProvider.state('pipelines', {
        url: '/pipelines',
        templateUrl: 'js/pipelines/pipelines.html',
        controller: 'PipelinesCtrl'
    });

});

app.controller('PipelinesCtrl', function($scope, Pipeline, $state, $stateParams, $mdDialog) {
    
    $scope.pipelineName = null;
    $scope.created = false;
    $scope.searchInput = null;
    $scope.searchUrl = {};
    $scope.models = {};
    $scope.loc = window.location.host;
    $scope.saved = 'untouched';
    $scope.urlState;
    $scope.pipelineId;
    $scope.errMessage;

    $scope.$on('deleteRepo',function(event,data){
        console.log('Heard delete repo!',data);
        $scope.deleteRepo(data[0],data[1],data[2]);
    });



    $scope.search = function(input) {
        $state.go('search', {
            input: input
        });
    };

    $scope.getRepoByUrl = function(url, pipelineId) {
        if (!url) return;
        $scope.searchUrl.url = null;
        $scope.pipelineId = pipelineId;
        $scope.urlState = 'pending';
        Pipeline.getByUrl(url)
            .then(function(response) {
                return Pipeline.add({
                    id: pipelineId,
                    repo: response
                })
            })
            .then(function(response) {
                $scope.searchUrl.url = '';
                $scope.urlState = 'valid';
                return $scope.getPipelines();
            })
            .catch(function(err) {
                $scope.urlState = 'invalid';
                $scope.errMessage = err.data || 'There was an error building your dockerfile ' 
            })
    };

    $scope.getUrl = function(id) {
        return `http://${$scope.loc}/api/run?id=${id}`;
    };


    $scope.createPipeline = function() {
        if (!$scope.pipelineName) return;
        Pipeline.create($scope.pipelineName)
            .then(function(response) {
                $scope.created = true;
                $scope.pipelineName = '';
                $scope.models.list = makePipelineModel(response);
            });
    };

    $scope.getPipelines = function() {
        Pipeline.get()
            .then(function(response) {
                var obj = makePipelineModel(response);
                $scope.models = {
                    selected: null,
                    list: obj
                }
            })
    };

    $scope.updatePipelines = function(repo) {
        if (repo) {
            Pipeline.update($scope.models.list, repo)
                .then(function(response) {
                    $scope.saved = 'saved';
                })
        } else {
            Pipeline.update($scope.models.list)
                .then(function(response) {
                    $scope.saved = 'saved';
                }) 
        }
    };

    $scope.reorder = function() {
        Object.keys($scope.models.list).forEach(function(key) {
            $scope.models.list[key].pipeline.map(function(repo, ix) {
                repo.order = ix;
            })
        })
        $scope.saved = 'unsaved';
    };

    $scope.deleteRepo = function(pipeline, ix, repo) {
        console.log('deleting',pipeline,repo);
        var deleted = $scope.models.list[pipeline.name].pipeline.splice(ix, 1)[0];
        $scope.reorder();
        $scope.updatePipelines(repo);
    };

    $scope.deletePipeline = function(pipeline) {
        Pipeline.delete(pipeline)
            .then(function() {
                delete $scope.models.list[pipeline.name];
            })
    };

    function makePipelineModel(data) {
        var obj = {};
        data.pipelines.forEach(function(pipeline) {
            obj[pipeline.name] = {
                pipelineId: pipeline._id,
                name: pipeline.name,
                pipeline: pipeline.pipeline
            }
        })
        return obj;
    };

    $scope.showConfirmPipeline = function(ev, pipeline) {
        var confirm = $mdDialog.confirm()
            .parent(angular.element(document.body))
            .title(`Are you sure you want to delete ${pipeline.name}?`)
            .content('')
            .ariaLabel('Warning')
            .ok('DELETE')
            .cancel('CANCEL')
            .targetEvent(ev);
        $mdDialog.show(confirm).then(function() {
            $scope.deletePipeline(pipeline);
        });
    };

    $scope.getPipelines();

});