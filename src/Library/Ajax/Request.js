/*
 * This file is part of the KUBEjs package
 *
 * (c) Red Scotch Software Inc <kube+js@redscotch.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

(function(KUBE){
    KUBE.LoadFactory('/Library/Ajax/Request', Request,['/Library/Extend/Object']);

    /* Currently this is an ugly piece of code and required refactoring and cleanup */
    Request.prototype.toString = function(){ return '[object '+this.constructor.name+']' };
    function Request(_headers,_method) {
        var $API,customHeaders,method,data;
        customHeaders = (KUBE.Is(_headers,true) === 'object' ? _headers : {});
        method = (KUBE.Is(_method) === 'string' ? _method : 'post');
        data = {};

        $API = {
            "GetHeaders":GetHeaders,
            "GetMethod":GetMethod,
            "GetData":GetData,
            "SetMethod":SetMethod,
            "AddData":AddData,
            "AddHeader":AddHeader
        }.KUBE().create(Request.prototype);
        return $API;

        //Get
        function GetHeaders(){
            return customHeaders;
        }

        function GetMethod(){
            return method;
        }

        function GetData(){
            return data;
        }

        //Set
        function SetMethod(_method){
            //TODO: Validate method before setting
            method = _method;
        }

        //Utilities
        function AddData(_key,_val){
            data[_key] = _val;
        }

        function AddHeader(_headerName,_headerData){
            customHeaders[_headerName] = _headerData;
        }

    }
}(KUBE));
