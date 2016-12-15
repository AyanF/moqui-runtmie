/* This software is in the public domain under CC0 1.0 Universal plus a Grant of Patent License. */

/* TODO:
 - use m-link for other links instead of a (or somehow intercept?)
 - do something with form submits to submit in background and refresh current html based component (new client rendered screens won't need this)

 - use vue-aware widgets or add vue component wrappers for scripts and widgets (like the select2 example on vuejs.org)
 - use something else for jstree and JSON to populate it generated by ScreenTree.groovy; some sort of vue compatible js tree?
 - remove all html script elements...

 - big new feature for client rendered screens
   - on the server render to a Vue component object (as JSON)
   - make these completely static, not dependent on any inline data, so they can be cached
   - separate request to get data to populate

 */

// simple stub for define if it doesn't exist (ie no require.js, etc)
if (!window.define) window.define = function(obj) { return obj };

const notifyOpts = { delay:6000, offset:{x:20,y:70}, type:'success', animate:{ enter:'animated fadeInDown', exit:'animated fadeOutUp' } };

// NOTE: this may eventually split to change the currentComponent only on currentPath change (for screens that support it)
//     and if ever needed some sort of data refresh if currentSearch changes
function loadComponent(url, callback, divId) {
    var questIdx = url.indexOf('?');
    var path = questIdx > 0 ? url.slice(0, questIdx) : url;
    var isJsPath = path.slice(-3) == '.js';
    if (!isJsPath) url = url + (questIdx > 0 ? '&' : '?') + "lastStandalone=-2";
    // console.log("loading " + url + " id " + divId);
    $.ajax({ type:"GET", url:url, success: function (screenText) {
        // console.log(screenText);
        if (screenText && screenText.length > 0) {
            if (isJsPath || screenText.slice(0,7) == 'define(') { callback(eval(screenText)); }
            else { callback({ template: '<div' + (divId && divId.length > 0 ? ' id="' + divId + '"' : '') + '>' + screenText + '</div>' }); }
        } else { callback(NotFound); }
    }});
}

var NotFound = Vue.extend({ template: '<div id="current-page-root"><h4>Screen not found at {{this.$root.currentPath}}</h4></div>' });
var EmptyComponent = Vue.extend({ template: '<div id="current-page-root"><img src="/images/wait_anim_16x16.gif" alt="Loading..."></div>' });

/* ========== inline components ========== */
Vue.component('m-link', {
    props: { href:{type:String,required:true}, loadId:String },
    template: '<a :href="href" @click.prevent="go"><slot></slot></a>',
    methods: { go: function go() {
        if (this.loadId && this.loadId.length > 0) { this.$root.loadContainer(this.loadId, this.href); }
        else { this.$root.goto(this.href); }
    }}
});
Vue.component('m-script', {
    template: '<div style="display:none;"><slot></slot></div>',
    mounted: function() {
        var parent = this.$el.parentElement; var s = document.createElement('script'); s.type = 'text/javascript';
        s.appendChild(document.createTextNode(this.$el.innerText));
        Vue.util.remove(this.$el); parent.appendChild(s);
    }
});
Vue.component('container-dialog', {
    props: { id:{type:String,required:true}, width:{type:String,default:'760'}, openDialog:{type:Boolean,default:false}, title:String },
    data: function() { return { isHidden:true, dialogStyle:{width:this.width + 'px'}}},
    template:
        '<div :id="id" class="modal dynamic-dialog" aria-hidden="true" style="display: none;" tabindex="-1">' +
            '<div class="modal-dialog" :style="dialogStyle"><div class="modal-content">' +
                '<div class="modal-header"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' +
                    '<h4 class="modal-title">{{title}}</h4></div>' +
                '<div class="modal-body"><slot></slot></div>' +
            '</div></div>' +
        '</div>',
    methods: { hide: function() { $(this.$el).modal('hide'); } },
    mounted: function() {
        var jqEl = $(this.$el); var vm = this;
        jqEl.on("hidden.bs.modal", function() { vm.isHidden = true; vm.$root.openModal = null; });
        jqEl.on("shown.bs.modal", function() { vm.isHidden = false; vm.$root.openModal = vm;
                jqEl.find("select").select2({ }); jqEl.find(".default-focus").focus(); });
        if (this.openDialog) { jqEl.modal('show'); }
    }
});
Vue.component('dynamic-container', {
    props: { id:{type:String,required:true}, url:{type:String} },
    data: function() { return { curComponent:EmptyComponent, curUrl:"" } },
    template: '<component :is="curComponent"></component>',
    methods: { reload: function() { var saveUrl = this.curUrl; this.curUrl = ""; var vm = this; setTimeout(function() { vm.curUrl = saveUrl; }, 20); },
        load: function(url) { this.curUrl = url; }},
    watch: { curUrl: function(newUrl) {
        if (!newUrl || newUrl.length === 0) { this.curComponent = EmptyComponent; return; }
        var vm = this; loadComponent(newUrl, function(comp) { vm.curComponent = comp; }, this.id);
    }},
    mounted: function() { this.$root.addContainer(this.id, this); this.curUrl = this.url; }
});
Vue.component('dynamic-dialog', {
    props: { id:{type:String,required:true}, url:{type:String,required:true}, width:{type:String,default:'760'},
        openDialog:{type:Boolean,default:false}, title:String },
    data: function() { return { curComponent:EmptyComponent, curUrl:"", isHidden:true, dialogStyle:{width:this.width + 'px'}}},
    template:
        '<div :id="id" class="modal dynamic-dialog" aria-hidden="true" style="display: none;" tabindex="-1">' +
            '<div class="modal-dialog" :style="dialogStyle"><div class="modal-content">' +
                '<div class="modal-header"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' +
                    '<h4 class="modal-title">{{title}}</h4></div>' +
                '<div class="modal-body"><component :is="curComponent"></component></div>' +
            '</div></div>' +
        '</div>',
    methods: {
        reload: function() { if (!this.isHidden) { var jqEl = $(this.$el); jqEl.modal('hide'); jqEl.modal('show'); }},
        load: function(url) { this.curUrl = url; }, hide: function() { $(this.$el).modal('hide'); }
    },
    watch: { curUrl: function (newUrl) {
        if (!newUrl || newUrl.length === 0) { this.curComponent = EmptyComponent; return; }
        var vm = this; loadComponent(newUrl, function(comp) { vm.curComponent = comp; }, this.id);
    }},
    mounted: function() {
        this.$root.addContainer(this.id, this); var jqEl = $(this.$el); var vm = this;
        jqEl.on("show.bs.modal", function() { vm.curUrl = vm.url; });
        jqEl.on("hidden.bs.modal", function() { vm.isHidden = true; vm.$root.openModal = null; vm.curUrl = ""; });
        jqEl.on("shown.bs.modal", function() { vm.isHidden = false; vm.$root.openModal = vm;
                jqEl.find("select").select2({ }); jqEl.find(".default-focus").focus(); });
        if (this.openDialog) { jqEl.modal('show'); }
    }
});
Vue.component('form-single', {
    props: { action:{type:String,required:true}, method:{type:String,default:'POST'}, isUpload:Boolean,
        submitMessage:String, submitReloadId:String, submitHideId:String, focusField:String },
    data: function() { return { fields:{} }},
    template: '<form @submit.prevent="submitForm" class="validation-engine-init"><slot></slot></form>',
    methods: {
        // TODO: anything special to handle upload fields? (isUpload)
        submitForm: function submitForm() {
            var jqEl = $(this.$el); if (jqEl.valid()) { jqEl.ajaxSubmit({ resetForm:false, type:this.method, url:this.action,
                data:this.fields, headers:{Accept:'application/json'}, success:this.handleResponse }); }
        },
        handleResponse: function(resp) {
            var notified = false;
            if (resp && resp === Object(resp)) {
                console.log('form-single response ' + JSON.stringify(resp));
                if (resp.messages) for (var mi=0; mi < resp.messages.length; mi++) {
                    $.notify({ message:resp.messages[mi] }, $.extend(notifyOpts, {type:'info'})); notified = true; }
                if (resp.errors) for (var ei=0; ei < resp.messages.length; ei++) {
                    $.notify({ message:resp.messages[ei] }, $.extend(notifyOpts, {delay:60000, type:'danger'})); notified = true; }
                if (resp.screenUrl && resp.screenUrl.length > 0) { this.$root.goto(resp.screenUrl); }
            }
            if (this.submitHideId && this.submitHideId.length > 0) { $('#' + this.submitHideId).modal('hide'); }
            if (this.submitReloadId && this.submitReloadId.length > 0) { this.$root.reloadContainer(this.submitReloadId); }
            var msg = this.submitMessage && this.submitMessage.length > 0 ? this.submitMessage : (notified ? null : "Form data saved");
            if (msg) $.notify({ message:msg }, $.extend(notifyOpts, {type:'success'}));
        }
    },
    mounted: function() {
        var jqEl = $(this.$el); jqEl.validate({ errorClass: 'help-block', errorElement: 'span',
            highlight: function(element, errorClass, validClass) { $(element).parents('.form-group').removeClass('has-success').addClass('has-error'); },
            unhighlight: function(element, errorClass, validClass) { $(element).parents('.form-group').removeClass('has-error').addClass('has-success'); }
        });
        jqEl.find('[data-toggle="tooltip"]').tooltip();
        if (this.focusField && this.focusField.length > 0) jqEl.find('[name=' + this.focusField + ']').addClass('default-focus').focus();
    }
});
/* ========== form field widget components ========== */
Vue.component('drop-down', {
    props: { options:Array, value:[Array,String], combo:Boolean, allowEmpty:Boolean, multiple:String,
        optionsUrl:String, optionsParameters:Object, labelField:String, valueField:String, dependsOn:Object },
    data: function() { return { curData: null, s2Opts: null } },
    template: '<select><slot></slot></select>',
    methods: {
        populateFromUrl: function() {
            if (!this.optionsUrl || this.optionsUrl.length === 0) return;
            var hasAllParms = true; var dependsOnMap = this.dependsOn; var parmMap = this.optionsParameters;
            var reqData = { moquiSessionToken: this.$root.moquiSessionToken };
            for (var parmName in parmMap) { if (parmMap.hasOwnProperty(parmName)) reqData[parmName] = parmMap[parmName]; }
            for (var doParm in dependsOnMap) { if (dependsOnMap.hasOwnProperty(doParm)) {
                var doValue = $('#' + dependsOnMap[doParm]).val();
                if (!doValue) { hasAllParms = false; break; }
                reqData[doParm] = doValue;
            }}
            if (!hasAllParms) { this.curData = null; return; }
            var vm = this;
            $.ajax({ type:"POST", url:this.optionsUrl, data:reqData, dataType:"json", success: function(list) { if (list) {
                var newData = [];
                if (vm.allowEmpty) newData.push({ id:'', text:'' });
                // var curValue = this.value; var isArray = Array.isArray(curValue);
                var labelField = vm.labelField; if (!labelField) labelField = "label";
                var valueField = vm.valueField; if (!valueField) valueField = "value";
                $.each(list, function(idx, curObj) {
                    // if ((isArray && curOptions.indexOf(optionValue) >= 0) || optionValue == "${currentValue}")
                    newData.push({ id: curObj[valueField], text: curObj[labelField] })
                });
                vm.curData = newData;
            }}});
        }
    },
    mounted: function() {
        var vm = this; var opts = { minimumResultsForSearch:15 };
        if (this.combo) { opts.tags = true; opts.tokenSeparators = [',',' ']; }
        if (this.multiple == "multiple") { opts.multiple = true; }
        if (this.options && this.options.length > 0) { opts.data = this.options; }
        this.s2Opts = opts; var jqEl = $(this.$el);
        jqEl.select2(opts).on('change', function () { vm.$emit('input', this.value); })
            .on('select2:select', function () { jqEl.select2('open').select2('close'); });
        if (this.value && this.value.length > 0) { this.curVal = this.value; }
        if (this.optionsUrl && this.optionsUrl.length > 0) {
            var dependsOnMap = this.dependsOn;
            for (var doParm in dependsOnMap) { if (dependsOnMap.hasOwnProperty(doParm)) {
                $('#' + dependsOnMap[doParm]).on('change', function() { vm.populateFromUrl(); }); }}
            this.populateFromUrl();
        }
    },
    watch: {
        value: function (value) { this.curVal = value; },
        options: function (options) { this.curData = options; },
        curData: function (options) { this.s2Opts.data = options; $(this.$el).select2(this.s2Opts); }
    },
    computed: {
        curVal: { get: function () { return $(this.$el).select2().val(); },
            set: function (value) { $(this.$el).select2().val(value).trigger('select2:change'); } }
    },
    destroyed: function () { $(this.$el).off().select2('destroy') }
});
Vue.component('text-autocomplete', {
    props: { id:{type:String,required:true}, name:{type:String,required:true}, value:String, valueText:String,
        type:String, size:String, maxlength:String, disabled:Boolean, validationClasses:String, dataVvValidation:String,
        required:Boolean, pattern:String, tooltip:String, form:String,
        url:{type:String,required:true}, dependsOn:Object, acParameters:Object, minLength:Number, showValue:Boolean, useActual:Boolean, skipInitial:Boolean },
    template: '<span><input ref="acinput" :id="acId" :name="acName" :type="type" :value="valueText" :size="size" :maxlength="maxlength" :disabled="disabled"' +
        ' :class="allClasses" :data-vv-validation="validationClasses" :required="required" :pattern="pattern"' +
        ' :data-toggle="tooltipToggle" :title="tooltip" autocomplete="off" :form="form">' +
        '<input ref="hidden" :id="id" type="hidden" :name="name" :value="value" :form="form">' +
        '<span ref="show" v-if="showValue" :id="showId" class="form-autocomplete-value">{{valueText}}</span></span>',
    methods: { },
    watch: { },
    computed: { acId: function() { return this.id + '_ac'; }, acName: function() { return this.name + '_ac'; },
        allClasses: function() { return 'form-control typeahead' + (this.validationClasses ? ' ' + this.validationClasses : ''); },
        showId: function() { return this.id + '_show'; }, tooltipToggle: function() { return this.tooltip && this.tooltip.length > 0 ? 'tooltip' : null; }
    },
    mounted: function() {
        var vm = this; var acJqEl = $(this.$refs.acinput); var hidJqEl = $(this.$refs.hidden);
        var showJqEl = this.$refs.show ? $(this.$refs.show) : null;
        acJqEl.typeahead({ minLength:(this.minLength ? this.minLength : 1), highlight: true, hint: false }, { limit: 20,
            source: function(query, syncResults, asyncResults) {
                var dependsOnMap = vm.dependsOn; var parmMap = vm.acParameters;
                var reqData = { term: query, moquiSessionToken: vm.$root.moquiSessionToken };
                for (var parmName in parmMap) { if (parmMap.hasOwnProperty(parmName)) reqData[parmName] = parmMap[parmName]; }
                for (var doParm in dependsOnMap) { if (dependsOnMap.hasOwnProperty(doParm)) {
                    var doValue = $('#' + dependsOnMap[doParm]).val(); if (doValue) reqData[doParm] = doValue; }}
                $.ajax({ url: vm.url, type:"POST", dataType:"json", data:reqData, success: function(data) {
                    asyncResults($.map(data, function(item) { return { label: item.label, value: item.value } })); }});
            },
            display: function(item) { return item.label; }
        });
        acJqEl.bind('typeahead:select', function(event, item) {
            if (item) { this.value = item.value; hidJqEl.val(item.value); hidJqEl.trigger("change"); acJqEl.val(item.label);
                if (showJqEl && item.label) { showJqEl.html(item.label); } return false; }
        });
        acJqEl.change(function() { if (!acJqEl.val()) { hidJqEl.val(""); hidJqEl.trigger("change"); }
                else if (this.useActual) { hidJqEl.val(acJqEl.val()); hidJqEl.trigger("change"); } });
        var dependsOnMap = this.dependsOn;
        for (var doParm in dependsOnMap) { if (dependsOnMap.hasOwnProperty(doParm)) {
            $('#' + dependsOnMap[doParm]).change(function() { hidJqEl.val(""); acJqEl.val(""); }); }}
        if (!this.skipInitial && hidJqEl.val()) {
            var parmMap = this.acParameters;
            var reqData = { term: hidJqEl.val(), moquiSessionToken: this.$root.moquiSessionToken };
            for (var parmName in parmMap) { if (parmMap.hasOwnProperty(parmName)) reqData[parmName] = parmMap[parmName]; }
            for (doParm in dependsOnMap) { if (dependsOnMap.hasOwnProperty(doParm)) {
                var doValue = $('#' + dependsOnMap[doParm]).val(); if (doValue) reqData[doParm] = doValue; }}
            $.ajax({ url:this.url, type:"POST", dataType:"json", data:reqData, success: function(data) {
                var curValue = hidJqEl.val();
                for (var i = 0; i < data.length; i++) { if (data[i].value == curValue) {
                    acJqEl.val(data[i].label); if (showJqEl) { showJqEl.html(data[i].label); } break; }}
            }});
        }
    }
});

/* ========== webrootVue - root Vue component with router ========== */
const webrootVue = new Vue({
    el: '#apps-root',
    data: { currentPath:"", currentSearch:"", currentParameters:{}, navMenuList:[], navHistoryList:[], navPlugins:[],
        currentComponent:EmptyComponent, loading:false, openModal:null, activeContainers:{},
        moquiSessionToken:"", appHost:"", appRootPath:"/", userId:"", partyId:"", notificationClient:null },
    methods: {
        goto: function (url) { this.CurrentUrl = url; window.history.pushState(null, this.ScreenTitle, url); },
        // all container components added with this must have reload() and load(url) methods
        addContainer: function (contId, comp) { this.activeContainers[contId] = comp; },
        reloadContainer: function(contId) { var contComp = this.activeContainers[contId];
            if (contComp) { contComp.reload(); } else { console.log("Container with ID " + contId + " not found, not reloading"); }},
        loadContainer: function(contId, url) { var contComp = this.activeContainers[contId];
            if (contComp) { contComp.load(url); } else { console.log("Container with ID " + contId + " not found, not loading url " + url); }},
        addNavPlugin: function(url) { var vm = this; loadComponent(url, function(comp) { vm.navPlugins.push(comp); }) },
        switchDarkLight: function() {
            var jqBody = $("body"); jqBody.toggleClass("bg-dark"); jqBody.toggleClass("bg-light");
            var currentStyle = jqBody.hasClass("bg-dark") ? "bg-dark" : "bg-light";
            $.ajax({ type:'POST', url:'/apps/setPreference', data:{ moquiSessionToken: this.moquiSessionToken,
                preferenceKey:'OUTER_STYLE', preferenceValue:currentStyle } });
        }
    },
    watch: {
        CurrentUrl: function(newUrl) {
            if (!newUrl || newUrl.length === 0) return;
            var vm = this;
            this.loading = true;
            console.log("CurrentUrl changing to " + newUrl);
            if (this.openModal) { this.openModal.hide(); this.openModal = null; }
            this.activeContainers = {};
            // update menu
            $.ajax({ type:"GET", url:"/menuData" + newUrl, dataType:"json",
                success: function(outerList) { if (outerList) { vm.navMenuList = outerList; } }});
            // update currentComponent
            loadComponent(newUrl, function (comp) { vm.currentComponent = comp; vm.loading = false; }, 'current-page-root');
        },
        navMenuList: function(newList) { if (newList.length > 0) {
            var cur = newList[newList.length - 1]; var par = newList.length > 1 ? newList[newList.length - 2] : null;
            var newTitle = (par ? par.title + ' - ' : '') + cur.title;
            var curUrl = cur.urlWithParams; var questIdx = curUrl.indexOf("?");
            if (questIdx > 0) {
                var parmList = curUrl.substring(questIdx+1).split("&");
                curUrl = curUrl.substring(0, questIdx);
                var dpCount = 0; var titleParms = "";
                for (var pi=0; pi<parmList.length; pi++) {
                    var parm = parmList[pi]; if (parm.indexOf("pageIndex=") == 0) continue;
                    if (curUrl.indexOf("?") == -1) { curUrl += "?"; } else { curUrl += "&"; }
                    curUrl += parm;
                    if (dpCount > 1) continue; // add up to 2 parms to the title
                    var eqIdx = parm.indexOf("=");
                    if (eqIdx > 0) {
                        var key = parm.substring(0, eqIdx);
                        if (key.indexOf("_op") > 0 || key.indexOf("_not") > 0 || key.indexOf("_ic") > 0 || key == "moquiSessionToken") continue;
                        if (titleParms.length > 0) titleParms += ", ";
                        titleParms += parm.substring(eqIdx + 1);
                    }
                }
                if (titleParms.length > 0) newTitle = newTitle + " (" + titleParms + ")";
            }
            for (var i=0; i<this.navHistoryList.length;) {
                if (this.navHistoryList[i].urlWithParams == curUrl) { this.navHistoryList.splice(i,1); }
                else { i++; }
            }
            this.navHistoryList.unshift({ title:newTitle, urlWithParams:curUrl, image:cur.image, imageType:cur.imageType });
            while (this.navHistoryList.length > 25) { this.navHistoryList.pop(); }
            document.title = newTitle;
        }},
        currentSearch: function(newSearch) {
            this.currentParameters = {}; if (!newSearch || newSearch.length == 0) { return };
            var parmList = newSearch.slice(1).split("&");
            for (var i=0; i<parmList.length; i++) {
                var parm = parmList[i]; var ps = parm.split("="); if (ps.length > 1) { this.currentParameters[ps[0]] = ps[1]; } }
        }
    },
    computed: {
        CurrentUrl: { get: function() { return this.currentPath + this.currentSearch; },
            set: function(href) {
                var ssIdx = href.indexOf('//');
                if (ssIdx >= 0) { var slIdx = href.indexOf('/', ssIdx + 1); if (slIdx == -1) { return; } href = href.slice(slIdx); }
                var splitHref = href.split("?"); this.currentPath = splitHref[0];
                if (splitHref.length > 1 && splitHref[1].length > 0) { this.currentSearch = '?' + splitHref[1]; } else { this.currentSearch = ""; }
            }
        },
        ScreenTitle: function() { return this.navMenuList.length > 0 ? this.navMenuList[this.navMenuList.length - 1].title : ""; }
    },
    components: {
        'add-nav-plugin': { props:{url:{type:String,required:true}}, template:'<span></span>',
            mounted:function() { this.$root.addNavPlugin(this.url); Vue.util.remove(this.$el); }}
    },
    created: function() {
        this.moquiSessionToken = $("#moquiSessionToken").val();
        this.appHost = $("#appHost").val(); this.appRootPath = $("#appRootPath").val();
        this.userId = $("#userId").val(); this.partyId = $("#partyId").val();
        this.notificationClient = new NotificationClient("ws://" + this.appHost + this.appRootPath + "/notws");
    },
    mounted: function() {
        $('.navbar [data-toggle="tooltip"]').tooltip();
        $('#history-menu-link').tooltip({ placement:'bottom', trigger:'hover' });
        // load the current screen
        this.CurrentUrl = window.location.pathname + window.location.search;
        // init the NotificationClient and register 'displayNotify' as the default listener
        this.notificationClient.registerListener("ALL");
    }
});
window.addEventListener('popstate', function() { webrootVue.CurrentUrl = window.location.pathname + window.location.search; });

// NotificationClient, note does not connect the WebSocket until notificationClient.registerListener() is called the first time
function NotifyOptions(message, url, type, icon) {
    this.message = message;
    if (url) this.url = url;
    if (icon) { this.icon = icon;
    } else {
        if (type == 'success') this.icon = 'glyphicon glyphicon-ok-sign';
        else if (type == 'warning') this.icon = 'glyphicon glyphicon-warning-sign';
        else if (type == 'danger') this.icon = 'glyphicon glyphicon-exclamation-sign';
        else this.icon = 'glyphicon glyphicon-info-sign';
    }
}
function NotifySettings(type) {
    this.delay = 6000; this.offset = { x:20, y:70 };
    this.animate = { enter:'animated fadeInDown', exit:'animated fadeOutUp' };
    if (type) { this.type = type; } else { this.type = 'info'; }
    this.template =
        '<div data-notify="container" class="notify-container col-xs-11 col-sm-3 alert alert-{0}" role="alert">' +
            '<button type="button" aria-hidden="true" class="close" data-notify="dismiss">&times;</button>' +
            '<span data-notify="icon"></span> <span data-notify="message">{2}</span>' +
            '<a href="{3}" target="{4}" data-notify="url"></a>' +
        '</div>'
}
function NotificationClient(webSocketUrl) {
    this.displayEnable = true;
    this.webSocketUrl = webSocketUrl;
    this.topicListeners = {};

    this.disableDisplay = function() { this.displayEnable = false; };
    this.enableDisplay = function() { this.displayEnable = true; };
    this.initWebSocket = function() {
        this.webSocket = new WebSocket(this.webSocketUrl);
        this.webSocket.clientObj = this;
        this.webSocket.onopen = function(event) {
            var topics = []; for (var topic in this.clientObj.topicListeners) { topics.push(topic); }
            this.send("subscribe:" + topics.join(","));
        };
        this.webSocket.onmessage = function(event) {
            var jsonObj = JSON.parse(event.data);
            var callbacks = this.clientObj.topicListeners[jsonObj.topic];
            if (callbacks) callbacks.forEach(function(callback) { callback(jsonObj, this) }, this);
            var allCallbacks = this.clientObj.topicListeners["ALL"];
            if (allCallbacks) allCallbacks.forEach(function(allCallbacks) { allCallbacks(jsonObj, this) }, this);
        };
        this.webSocket.onclose = function(event) { console.log(event); };
        this.webSocket.onerror = function(event) { console.log(event); };
    };
    this.displayNotify = function(jsonObj, webSocket) {
        if (!webSocket.clientObj.displayEnable) return; // console.log(jsonObj);
        if (jsonObj.title && jsonObj.showAlert == true) {
            $.notify(new NotifyOptions(jsonObj.title, jsonObj.link, jsonObj.type, jsonObj.icon), new NotifySettings(jsonObj.type)); }
    };
    this.registerListener = function(topic, callback) {
        if (!this.webSocket) this.initWebSocket();

        if (!callback) callback = this.displayNotify;
        var listenerArray = this.topicListeners[topic];
        if (!listenerArray) {
            listenerArray = []; this.topicListeners[topic] = listenerArray;
            if (this.webSocket.readyState == WebSocket.OPEN) this.webSocket.send("subscribe:" + topic);
        }
        if (listenerArray.indexOf(callback) < 0) { listenerArray.push(callback); }
    };
}
/* Example Notification Listener Registration (note listener method defaults to displayNotify as in first example;
you can register more than one listener method for the same topic):
<#if ec.factory.serverContainer?has_content>
    <script>
        notificationClient.registerListener("ALL"); // register for all topics
        notificationClient.registerListener("MantleEvent", notificationClient.displayNotify);
    </script>
</#if>
*/
