(function(KUBE) {
    "use strict";
    /* Load class */
    KUBE.LoadFactory('/Library/Tools/Sync', Sync,['/Library/DOM/DomJack','/Library/Tools/Hash']);

    Sync.prototype.toString = function () {
        return '[object ' + this.constructor.name + ']'
    };
    function Sync(_Into,_templateString) {
        var Events,ParentDJ,template,data,DJ,jobs,serverJobs,Hash,order,runTrigger,Rows,sortBy,triggerReorder,state,filterFn,rowNodeType;
        state = true;
        runTrigger = false;
        triggerReorder = false;
        rowNodeType = "div";
        filterFn;
        data = {};
        jobs = [];
        Rows = {};
        sortBy = [];
        order = [];
        serverJobs = {
            'delete':[],
            'update':{},
            'new':{}
        };

        DJ = KUBE.Class('/Library/DOM/DomJack');
        Hash = KUBE.Class('/Library/Tools/Hash')();

        Events = KUBE.Events();

        if(_Into){
            Into(_Into);
        }

        if(_templateString){
            SetTemplate(_templateString);
        }

        return {
            "SetTemplate":SetTemplate,
            "On": Events.On,
            "Into":Into,
            "AddNew":AddNew,
            "Sync":Sync,
            "Add":Add,
            "Remove":Remove,
            "Delete":Delete,
            "Update":Update,
            "SetSort":SetSort,
            "SetMultiSort":SetMultiSort,
            "SetRowNodeType": SetRowNodeType,
            SetFilter:SetFilter,
            'Cleanup':Cleanup,
            "Get":Get,
            "GetAll": GetAll,
            "GetAllOrdered": GetAllOrdered,
            "GetByOrder":GetByOrder,
            "Count":Count,
            "ConnectSyncData":ConnectSyncData
        };

        function ConnectSyncData(_SyncData){
            if(KUBE.Is(_SyncData,true) === 'SyncData'){
                _SyncData.On('create',syncConnectCreate);
                _SyncData.On('update',syncConnectUpdate);
                _SyncData.On('delete',syncConnectDelete);
                _SyncData.Once('detach',reverseDetach);
                On('detach',function(){
                    _SyncData.RemoveListener('create',syncConnectCreate);
                    _SyncData.RemoveListener('update',syncConnectUpdate);
                    _SyncData.RemoveListener('delete',syncConnectDelete);
                    _SyncData.RemoveListener('detach',reverseDetach);
                });
            }

            function syncConnectCreate(_key,_val){
                var o = {};
                o[_key] = _val;
                Add(o);
            }

            function syncConnectUpdate(_key,_val){
                var o = {};
                o[_key] = _val;
                Update(o);
            }

            function syncConnectDelete(_key,_val){
                var o = {};
                o[_key] = _val;
                Delete(o);
            }

            function reverseDetach(){
                Events.Emit('detach');
            }
        }

        function Count(){
            return data.KUBE().count();
        }

        function SetTemplate(_string){
            if(!state){
                return false;
            }
            if(_string && KUBE.Is(_string) === 'string'){
                template = _string;
            }
            else if(KUBE.Is(_string) === 'function'){
                template = ''.KUBE().multiLine(_string);
            }
        }

        function Into(_DJ){
            if(!state){
                return false;
            }
            if(KUBE.Is(_DJ,true) === 'DomJack'){
                ParentDJ = _DJ;
                ParentDJ.On('delete',Cleanup);
            }
        }

        function AddNew(_key,_dataObj,_prepend){
            if(!state){
                return false;
            }
            if(data[_key] === undefined){
                serverJobs.new[_key] = _dataObj;
                var obj = {};
                obj[_key] = _dataObj;
                Add(obj,_prepend);
            }
        }

        function Sync(_obj,_prepend){
            _obj = _obj || {};
            if(!state){
                return false;
            }
            //First we call Updates
            _obj.KUBE().each(function(_key,_val){
                if(data[_key] !== undefined){
                    updateItem(_key,_val);
                }
            });

            //Then Deletes
            data.KUBE().each(function(_key,_syncObj){
                if(_obj[_key] === undefined){
                    deleteItem(_key,_syncObj);
                }
            });

            //Add Adds
            _obj.KUBE().each(function(_key,_val){
                if(data[_key] === undefined){
                    addItem(_key,_val,_prepend);
                }
            });
            triggerJobs();
        }

        function Get(_id){
            if(!state){
                return false;
            }
            return data[_id];
        }

        function GetAll(_filterBy){
            var ret = data;
            if(KUBE.Is(_filterBy) === "function") {
                ret = {};
                data.KUBE().each(function (k,v,o) {
                    if(_filterBy(k,v)){
                        ret[k] = v;
                    }
                });
            }
            return ret;
        }

        function GetAllOrdered(){
            var ret = {};
            if(sortBy){
                order.KUBE().each(function(_syncKey,_index){
                   ret[_syncKey] = data[_syncKey];
                });
            }
            else{
                throw new Error("Can't get ordered data from unordered Sync");
            }
            return ret;
        }

        function GetByOrder(_order){
            if(!state){
                return false;
            }
            var key = order[_order];
            return (key ? data[key] : false);
        }

        function Add(_obj,_prepend){
            if(!state){
                return false;
            }
            //We only add missing items from this object
            _obj.KUBE().each(function(_key,_val){
                addItem(_key,_val,_prepend);
            });
            triggerJobs();
        }

        function Remove(_obj){
            if(!state){
                return false;
            }
            //We only remove items that are not in this object (this tends to be what you actually want to do, though may seem odd at first)
            data.KUBE().each(function(_key,_val){
                if(_obj[_key] === undefined){
                    deleteItem(_key,_val);
                }
            });
            triggerJobs();
        }

        //Basically the opposite of remove. We remove the items that you pass. This makes sense for spot removal by the server (as opposed to sync type operations)
        function Delete(_obj){
            if(!state){
                return false;
            }
            //We only remove items that are not in this object (this tends to be what you actually want to do, though may seem odd at first)
            _obj.KUBE().each(function(_key,_val){
                if(data[_key] !== undefined){
                    deleteItem(_key,_val);
                }
            });
            triggerJobs();
        }

        function Update(_obj){
            if(!state){
                return false;
            }
            //We look for items that have changed, and we update them
            _obj.KUBE().each(function(_key,_val){
                updateItem(_key,_val);
            });
            triggerJobs();
        }

        function SetSort(_key,_reverse){
            if(!state){
                return false;
            }
            sortBy = [];
            sortBy.push(['data.'+_key,_reverse,true]);
            reorder();
        }

        function SetMultiSort(_multiSort){
            if(!state){
                return false;
            }
            if(KUBE.Is(_multiSort) === 'array'){
                sortBy = [];
                _multiSort.KUBE().each(function(_sortArray){
                    _sortArray[0] = 'data.'+_sortArray[0]
                    _sortArray[2] = true;
                    sortBy.push(_sortArray);
                });
                reorder();
            }
        }

        function SetRowNodeType(_type){
            rowNodeType = _type;
        }

        function SetFilter(_filterFn){
            filterFn = _filterFn;
            triggerJobs();
        }

        function Cleanup(){
            if(state){
                state = false;
                Events.Emit('detach');
                Events = ParentDJ = template = data = DJ = jobs = serverJobs = Hash = order = runTrigger = Rows = sortBy = triggerReorder = undefined;
            }
        }

        //For server jobs
        function addItem(_key,_val,_prepend){
            if(data[_key] === undefined){
                var Row = DJ(rowNodeType);
                var Template = Row.BuildInner(template);
                data[_key] = {
                    'key':_key,
                    'data':_val,
                    'f':changeFunc(_key)
                };

                Rows[_key] = [Row,Template];
                Events.Emit('create',data[_key],Template,Row);

                jobs.push(function(){
                    insert(_key,_prepend);
                });
            }
        }

        function updateItem(_key,_val){
            if(data[_key] !== undefined){
                jobs.push(function(){
                    Events.Emit('update',data[_key],_val,Rows[_key][1],Rows[_key][0]);
                });
                if(sortBy.length){
                    reorder();
                }
            }
        }

        function deleteItem(_key){
            if(data[_key] !== undefined){
                var syncObj = data[_key];

                var R = Rows[_key][0];
                var T = Rows[_key][1];

                delete data[_key];
                delete Rows[_key];
                var index = order.indexOf(_key);
                order.splice(index,1);

                Events.Emit('delete',syncObj,T,R);

                jobs.push(function(){
                    R.Delete();
                });
            }
        }

        function changeFunc(_key){
            return {
                'delete':function(){
                    if(!state){
                        return false;
                    }
                    serverJobs.delete.push(_key);
                    deleteItem(_key);
                    triggerJobs();
                },
                'update':function(_newObj){
                    if(!state){
                        return false;
                    }

                    data[_key].data = _newObj;
                    if(sortBy.length){
                        reorder();
                    }
                    serverJobs.update[_key] = _newObj;
                    triggerJobs();
                }
            };
        }

        function insert(_key,_prepend){
            if(sortBy.length){
                var R = Rows[_key];
                if(R && KUBE.Is(R[0],true) === 'DomJack'){
                    order = data.KUBE().valueObjectSort(sortBy);
                    var index = order.indexOf(_key);
                    if(index){
                        ParentDJ.Insert(R[0],index);
                    }
                }
            }
            else{
                var R = Rows[_key];
                if(R && KUBE.Is(R[0],true) === 'DomJack'){
                    if(_prepend){
                        order.unshift(_key);
                        ParentDJ.Prepend(R[0]);
                    }
                    else{
                        order.push(_key);
                        ParentDJ.Append(R[0]);
                    }
                }
            }
        }

        function reorder(){
            triggerReorder = true;
            triggerJobs();
        }

        function triggerJobs(){
            if(!state){
                return false;
            }
            if(!runTrigger){
                runTrigger = true;
                runJobs();
            }
        }

        function runJobs(){
            if(!state){
                return false;
            }
            requestAnimationFrame(function(){
                runTrigger = false;
                if(jobs.length){
                    var jobBatch = jobs;
                    jobs = [];
                    jobBatch.KUBE().each(function(_f){
                        _f();
                    });
                }
                if(serverJobs.delete.length || !serverJobs.new.KUBE().isEmpty() || !serverJobs.update.KUBE().isEmpty()){
                    var sJobs = serverJobs;
                    serverJobs = {
                        'delete':[],
                        'update':{},
                        'new':{}
                    };
                    Events.Emit('submit',sJobs);
                }
                if(triggerReorder || filterFn){
                    //ParentDJ.DetachChildren();
                    if(sortBy){
                        order = data.KUBE().valueObjectSort(sortBy);
                        order.KUBE().each(function(_key,_index){
                            var R = Rows[_key][0];
                            if(KUBE.Is(filterFn) === "function"){
                                if(filterFn(data[_key])){
                                    if(ParentDJ.GetChild(_index) !== R){
                                        ParentDJ.Insert(R,_index);
                                    }
                                }
                            }
                            else{
                                if(ParentDJ.GetChild(_index) !== R){
                                    ParentDJ.Insert(R,_index);
                                }
                            }
                        });
                    }
                    else{
                        data.KUBE().each(function(k,v){
                            if(filterFn(data[_key])){
                                var R = Rows[k][0];
                                ParentDJ.Append(R);
                            }
                        });
                    }

                }
            });
        }
    }
}(KUBE));