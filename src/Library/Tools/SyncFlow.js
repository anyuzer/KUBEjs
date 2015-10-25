//My experimental attempt at integrating our old QuickFlow into Sync...

(function(KUBE) {
    "use strict";
    /* Load class */
    KUBE.LoadFactory('/Library/Tools/SyncFlow', SyncFlow,['/Library/DOM/DomJack','/Library/Tools/Hash','/Library/DOM/StyleJack','/Library/Extend/Object','/Library/Extend/Array']);

    SyncFlow.prototype.toString = function () {
        return '[object ' + this.constructor.name + ']'
    };
    function SyncFlow(_Into,_templateString) {
        var DJ,Hash,Events,Pusher,TallBlock,ParentDJ,template,data,jobs,serverJobs,intoHeight,order,reflow,Rows,inView,positionCache,totalHeight,runTrigger;

        //All of our Defaults
        DJ = KUBE.Class('/Library/DOM/DomJack');
        Hash = KUBE.Class('/Library/Tools/Hash')();
        Events = KUBE.Events();

        reflow = false;
        runTrigger = false;

        jobs = [];
        order = [];
        Rows = [];
        inView = [];
        data = {};

        serverJobs = {
            'delete':[],
            'update':{},
            'new':{}
        };

        positionCache = {
            'x10':[],
            'x100':[],
            'x1000':[],
            'x10000':[]
        };

        //Initialize constructor vars
        if(_Into){
            Into(_Into);
        }

        if(_templateString){
            SetTemplate(_templateString);
        }

        runJobs();

        return {
            "SetTemplate":SetTemplate,
            "SetSortKeys":SetSortKeys,
            "On": Events.On,
            "Into":Into,
            "AddNew":AddNew,
            "Sync":Sync,
            "Add":Add,
            "Remove":Remove,
            "Update":Update,
            "Sort":Sort,
            "Reflow":Reflow
        };

        //QuickFlow
        function Reflow(){
            var scrollPos,pops,spaceUsed,rows,height,index,newRows,R,T;

            inView = [];
            scrollPos = ParentDJ.GetNode().scrollTop;
            pops = [];
            height = 0;

            if(scrollPos < intoHeight/2){
                rows = 0;
                index = 0;
                Pusher.Style().Height(0);

                while(height < (intoHeight*2) && order[index] !== undefined){
                    pops.push(index);
                    inView.push(order[index]);
                    height += data[order[index]].height;
                    index++;
                }

                if(Rows.length < pops.length){
                    for(newRows = Rows.length-1;newRows<pops.length;newRows++){
                        R = DJ('div');
                        R.Style().Position('relative').Width('100%');
                        Rows.push({
                            'R':R,
                            'T': R.BuildInner(template)
                        });
                        TallBlock.Append(R);
                    }
                }

                for(var i=0;i<Rows.length;i++){
                    if(i < pops.length){
                        if(Rows[i].R.IsDetached()){
                            TallBlock.Append(Rows[i].R);
                        }
                    }
                    else if(i >= pops.length){
                        if(!Rows[i].R.IsDetached()){
                            Rows[i].R.Detach();
                        }
                    }
                }
            }
            else{
                //Closest 0:index 1:position
                var closest = calcIndex(scrollPos-Math.floor(intoHeight/2));

                index = closest[0];
                while(height < intoHeight*2 && order[index] !== undefined){
                    pops.push(index);
                    inView.push(order[index]);
                    height += data[order[index]].height;
                    index++;
                }

                if(height+closest[1] > totalHeight){
                    Pusher.Style().Height(height-totalHeight);
                }
                else{
                    Pusher.Style().Height(closest[1]);
                }

                for(var i=0;i<Rows.length;i++){
                    if(i < pops.length){
                        if(Rows[i].R.IsDetached()){
                            TallBlock.Append(Rows[i].R);
                        }
                    }
                    else if(i >= pops.length){
                        if(!Rows[i].R.IsDetached()){
                            Rows[i].R.Detach();
                        }
                    }
                }
            }

            pops.KUBE().each(function(_orderIndex,_index){
                var obj,R,T;
                obj = data[order[_orderIndex]];

                R = Rows[_index].R;
                T = Rows[_index].T;
                R.Clear(undefined,true);
                R.Style().Height(obj.height);

                Events.Emit('populate',obj,T,R);
            });

            //We use inView for Sync
        }

        //This is silly, but temporary as I work through understanding how stable this is (isn't) and opportunities for optimization

        function initQF(){
            if(ParentDJ){
                ParentDJ.Style().Overflow(['hidden','auto']);
                TallBlock = ParentDJ.Append('div');
                TallBlock.Style().Width('100%').Position('relative').Height(intoHeight);
                Pusher = TallBlock.Append('div');
                Pusher.Style().Width('100%').Height(0).Position('relative');
                ParentDJ.GetNode().style.webkitOverflowScrolling = 'touch';
                ParentDJ.On('scroll',Reflow);
            }
        }

        //Sync
        function SetTemplate(_string){
            if(_string && KUBE.Is(_string) === 'string'){
                template = _string;
            }
            else if(KUBE.Is(_string) === 'function'){
                template = ''.KUBE().multiLine(_string);
            }
        }

        function SetSortKeys(_obj){
            //Not yet
        }

        function Into(_DJ){
            if(KUBE.Is(_DJ,true) === 'DomJack'){
                ParentDJ = _DJ;
                intoHeight = ParentDJ.GetDrawDimensions().height;
                initQF();
            }
        }

        function AddNew(_key,_dataObj,_prepend){
            if(data[_key] === undefined){
                serverJobs.new[_key] = _dataObj;
                var obj = {};
                obj[_key] = _dataObj;
                Add(obj,_prepend);
            }
        }

        function Sync(_obj,_prepend){
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

            syncOrder();
            cachePositions();
            recalcScroll();
            reflow = true;
            triggerJobs();
        }

        function Add(_obj,_prepend){
            _obj.KUBE().each(function(_key,_val){
                addItem(_key,_val,_prepend);
            });

            cachePositions();
            recalcScroll();
            reflow = true;
            triggerJobs();
        }

        function Remove(_obj){
            //We only remove items that are not in this object (this tends to be what you actually want to do, though may seem odd at first)
            data.KUBE().each(function(_key,_val){
                if(_obj[_key] === undefined){
                    deleteItem(_key,_val);
                }
            });

            syncOrder();
            cachePositions();
            recalcScroll();
            reflow = true;
            triggerJobs();
        }

        function Update(_obj){
            //We look for items that have changed, and we update them
            _obj.KUBE().each(function(_key,_val){
                updateItem(_key,_val);
            });
            triggerJobs();
        }

        function Sort(_obj){
            //Not yet
        }

        //For server jobs
        function addItem(_key,_val,_prepend){
            if(data[_key] === undefined){
                data[_key] = {
                    'key':_key,
                    'data':_val,
                    'dataHash':Hash.DeepHash(_val),
                    'height':0,
                    'reflow':function(){
                        reflowItem(_key);
                    }
                };
                Events.Emit('calcHeight',data[_key]);

                if(_prepend){
                    order.unshift(_key);
                }
                else{
                    order.push(_key);
                }
            }
        }

        function reflowItem(_key){
            var index = order.indexOf(_key);
            var obj = data[_key];

            //This is the next order of optimization.
            updatePositionCache(index);
            recalcScroll();
            Reflow();
        }

        function syncOrder(){
            if(order.length !== data.KUBE().count()){
                var tempOrder = {};
                data.KUBE().each(function(_key,_val){
                    tempOrder[order.indexOf(_key)] = _key;
                });
                order = [];
                tempOrder.KUBE().each(function(_oldOrder,_key){
                    order.push(_key);
                });
            }
        }

        function updateItem(_key,_val){
            if(data[_key] !== undefined){
                var checkHash = Hash.DeepHash(_val);
                if(data[_key].dataHash !== checkHash){
                    var syncObj = data[_key];
                    syncObj.data = _val;
                    syncObj.dataHash = checkHash;

                    if(inView.indexOf(_key) !== -1){
                        reflow = true;
                    }
                };
            }
        }

        function deleteItem(_key,_val){
            if(data[_key] !== undefined){
                var syncObj = data[_key];
                delete data[_key];

                if(inView.indexOf(_key) !== -1){
                    reflow = true;
                }
            }
        }

        function changeFunc(_key){
            return {
                'delete':function(){
                    var obj = data[_key];
                    delete data[_key];
                    serverJobs.delete.push(_key);

                    syncOrder();
                    cachePositions();
                    recalcScroll();

                    if(inView.indexOf(_key) !== -1){
                        reflow = true;
                    }

                    triggerJobs();
                },
                'update':function(_newObj){
                    var checkHash = Hash.DeepHash(_newObj);
                    if(data[_key].dataHash !== checkHash){
                        data[_key].dataHash = checkHash;
                        data[_key].data = _newObj;
                        serverJobs.update[_key] = _newObj;

                        if(inView.indexOf(_key) !== -1){
                            reflow = true;
                        }

                        triggerJobs();
                    }
                }
            };
        }

        //Job Management
        function triggerJobs(){
            runTrigger = true;
            runJobs();
        }

        function runJobs(){
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
                if(reflow){
                    reflow = false;
                    Reflow();
                }
            });
        }

        //My awkward maths
        function cachePositions(){
            var counters = {
                "x10":0,
                "x100":0,
                "x1000":0,
                "x10000":0
            };

            positionCache = {
                'x10':[],
                'x100':[],
                'x1000':[],
                'x10000':[]
            };

            order.KUBE().each(function(_key,_index){
                if(_index%10 === 0 && _index){
                    positionCache.x10.push(counters.x10);
                    counters.x10 = 0;
                }

                if(_index%100 === 0 && _index){
                    positionCache.x100.push(counters.x100);
                    counters.x100 = 0;
                }

                if(_index%1000 === 0 && _index){
                    positionCache.x1000.push(counters.x1000);
                    counters.x1000 = 0;
                }

                if(_index%10000 === 0 && _index){
                    positionCache.x10000.push(counters.x10000);
                    counters.x10000 = 0;
                }

                //I know this is stupid. I will derive properly later
                counters.x10 += data[_key].height;
                counters.x100 += data[_key].height;
                counters.x1000 += data[_key].height;
                counters.x10000 += data[_key].height;
            });
        }

        function updatePositionCache(_index){
            var keyLocation,start,end,height;

            //I know I can combine this in a single loop, but overall the effeciency should be the same
            keyLocation = (_index-(_index%10))/10;
            start = keyLocation*10;
            end = start+10;
            height = 0;
            for(;start<end;start++){
                if(order[start] !== undefined){
                    height += data[order[start]].height;
                }
                else{
                    break;
                }
            }
            positionCache.x10[keyLocation] = height;

            if(order.length > 100){
                //100s
                height = 0;
                keyLocation = (_index-(_index%100))/100;
                start = keyLocation*10;
                end = start+10;
                for(;start<end;start++){
                    if(positionCache.x10[start] !== undefined){
                        height += positionCache.x10[start];
                    }
                    else{
                        break;
                    }
                }
                positionCache.x100[keyLocation] = height;
            }
            if(order.length > 1000){
                //1ks
                height = 0;
                keyLocation = (_index-(_index%1000))/1000;
                start = keyLocation*10;
                end = start+10;
                for(;start<end;start++){
                    if(positionCache.x100[start] !== undefined){
                        height += positionCache.x100[start];
                    }
                    else{
                        break;
                    }
                }
                positionCache.x1000[keyLocation] = height;
            }
            if(order.length > 10000){
                //I will need to update the 10ks
                height = 0;
                keyLocation = (_index-(_index%10000))/10000;
                start = keyLocation*10;
                end = start+10;
                for(;start<end;start++){
                    if(positionCache.x1000[start] !== undefined){
                        height += positionCache.x1000[start];
                    }
                    else{
                        break;
                    }
                }
                positionCache.x10000[keyLocation] = height;
            }
        }

        function recalcScroll(){
            var boxHeight = 0;
            var pointer = 0;
            positionCache.x10000.KUBE().each(function(_height){
                pointer++;
                boxHeight += _height;
            });

            pointer *= 10;
            for(;pointer<positionCache.x1000.length;pointer++){
                boxHeight += positionCache.x1000[pointer];
            }

            pointer *= 10;
            for(;pointer<positionCache.x100.length;pointer++){
                boxHeight += positionCache.x100[pointer];
            }

            pointer *= 10;
            for(;pointer<positionCache.x10.length;pointer++){
                boxHeight += positionCache.x10[pointer];
            }

            pointer *= 10;
            for(;pointer<order.length;pointer++){
                boxHeight += data[order[pointer]].height;
            }
            totalHeight = boxHeight;

            TallBlock.Style().Height(boxHeight);
        }

        function calcClosest(_scrollPos){
            return calcIndex(_scrollPos);
        }

        function calcIndex(_scrollPos){
            if(_scrollPos === 0){
                return [0,0];
            }

            var position = 0;
            for(var pointer=0;pointer<positionCache.x10000.length;pointer++){
                if(position+positionCache.x10000[pointer] > _scrollPos){
                    break;
                }
                position += positionCache.x10000[pointer];
            }

            pointer *= 10;
            for(;pointer<positionCache.x1000.length;pointer++){
                if(position+positionCache.x1000[pointer] > _scrollPos){
                    break;
                }
                position += positionCache.x1000[pointer];
            }

            pointer *= 10;
            for(;pointer<positionCache.x100.length;pointer++){
                if(position+positionCache.x100[pointer] > _scrollPos){
                    break;
                }
                position += positionCache.x100[pointer];
            }

            pointer *= 10;
            for(;pointer<positionCache.x10.length;pointer++){
                if(position+positionCache.x10[pointer] > _scrollPos){
                    break;
                }
                position += positionCache.x10[pointer];
            }

            pointer *= 10;
            for(;pointer<order.length;pointer++){
                if(position+data[order[pointer]].height > _scrollPos){
                    return [pointer,position];
                    break;
                }
                position += data[order[pointer]].height;
            }
        }
    }
}(KUBE));


//As a note this is basically what I did for AddQ but I kind of think we should manage that from the outside...
//var objCount = _obj.KUBE().count();
//if(objCount < 1000 && addQ.length === 0){
//    _obj.KUBE().each(function(_key,_val){
//        addItem(_key,_val,_prepend);
//    });
//    recalcScroll();
//    cachePositions();
//    reflow = true;
//    triggerJobs();
//}
//else{
//    if(objCount > 1000){
//        var Q = {};
//        var count = 0;
//        _obj.KUBE().each(function(_key,_val){
//            Q[_key] = _val;
//            count++;
//            if(count === 1000){
//                Add(Q,_prepend);
//                count = 0;
//                Q = {};
//            }
//        });
//        if(!Q.KUBE().isEmpty()){
//            Add(Q,_prepend);
//        }
//        triggerJobs();
//    }
//    else{
//        console.log('ever hit here?');
//        //The Q is firing, we'll just add this batch to that
//        addQ.push(function(){
//            _obj.KUBE().each(function(_key,_val){
//                addItem(_key,_val,_prepend);
//            });
//            recalcScroll();
//            cachePositions();
//            reflow = true;
//            triggerJobs();
//        });
//    }
//}