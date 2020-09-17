/* global _, kendo, pageForm */
/* ------------------------------------------------------- */
/* ------------ Custom Announcement Templates ------------ */
/* ------------------------------------------------------- */
// Tested with Service Manager Portal v10.2.0.2016
// Tested in Google Chrome and Edge Chromium
/**
 * @description Adds a template function to New Announcement form Body editor by adding a drop downlist functionality to the editor toolbar
 * @author Ryan Lane
 * @see {@link https://community.cireson.com/discussion/5699/announcement-template-function} by Mikkel Madsen
 * @see {@link https://community.cireson.com/discussion/5136/kb-templates} by Justin Workman
 * @version 0.1
 */

(function(){ 
/* Waits for Document ready event to allow form view model to be initialized. */
$(document).ready(function() {
  var templateToolConfig = {
    propertyName: 'Body',
    // default: 'Opdater status',
    templates: [
      {
        displayName: 'Ny driftsforstyrrelse',
        id: 'Ny driftsforstyrrelse',
      },
      {
        displayName: 'Opdater status',
        id: 'Opdater status',
      },
      {
        displayName: 'Fejlen er løst',
        id: 'Fejlen er løst',
      },
      {
        displayName: 'Fejlen er løst (Simplified Id)',
        id: 'Fejlen',
      },
      {
        displayName: 'Planlagt driftsforstyrrelse',
        id: 'Planlagt driftsforstyrrelse',
      },
    ],
  };
  new CustomTemplateEditorTool(templateToolConfig).bind();

  function CustomTemplateEditorTool(config) {
    'use strict';
    var that = this;
    this.defaults = {
      propertyName: 'Body',
      path: '/CustomSpace/AnnouncementTemplates/',
      templates: [{
        displayName: 'Default Template',
        id: 'default',
      }],
    };
    this.init = function() {
      _.defaults(config, this.defaults);
      this.propertyName = config.propertyName;
      this.templates = config.templates;
      this.templatesPath = config.path;
      this.formSelector = '.cs-form__editor--' + config.propertyName;
      this.default = config.default;
      this.editorReady(this._build);
      return this;
    };

    this._editorReady = $.Deferred();
    this.editorReady = function(callback) {
      if (_.isFunction(callback)) {
        this._editorReady.done(callback).catch(function(e) {
          $.readyException(e);
        });
      }
      return this._editorReady.promise();
    };

    this.bind = function() {
      if ($(this.formSelector).find('.k-editor-toolbar').length) {
        /* Kendo Editor is initialized so resolve ready promise immediately. */
        this._editorReady.resolveWith(this);
      } else {
        /*
         * Waits for adminMain to interact with form view model via formHelper.manageDirty.
         * Once isDirty is set then the form is loaded and the Kendo Editor is initialzied after 100ms timer.
         * Mutation Observer waits for Kendo Editor to modify DOM before continuing.
         */
        pageForm.viewModel.bind('set', function initSetHandler(e) {
          /**
           * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver}
           * Mutation Observer callback Waits for TABLE to be added to watched node and then resolve ready promise.
           */
          var observerCallback = function(mutationsList, observer) {
            _.each(mutationsList, function(mutation) {
              _.each(mutation.addedNodes, function(nodeItem) {
                if (nodeItem.nodeName === 'TABLE') {
                  observer.disconnect();
                  that._editorReady.resolveWith(that);
                }
              });
            });
          };
          if (e.field === 'isDirty') {
            /* Unregisters handler to limit calling to first time only. */
            pageForm.viewModel.unbind('set', initSetHandler);
            /* Defers init until Kendo Editor is initialzied. */
            var windowObserver = new MutationObserver(observerCallback);
            windowObserver.observe($(that.formSelector).get(0), {attributes: false, childList: true, subtree: false});
            /*
             * Timeout Observer for performance.
             * This may be an unnecessary optimization, but would be useful if the Editor fails to load.
             */
            setTimeout(function() {
              windowObserver.disconnect();
              that._editorReady.reject('Template Tool timed out waiting for Kendo Editor.');
            }, 5000);
          }
        });
      }
      return this;
    };

    this._build = function() {
      var formGroup = $(this.formSelector);

      /* Creates tool template. */
      var toolGroup = $('<li>', {class: 'k-tool-group col-md-3', role: 'presentation', style: 'float: none;'});
      var templateDivFormGroup = $('<div>', {class: 'form-group', style: 'margin-bottom: 0px'});
      var comboBoxControl = $('<div>', {class: 'k-combobox form-control form-control-picker'});
      templateDivFormGroup.append(comboBoxControl);
      toolGroup.append(templateDivFormGroup);

      /* Appends tool to Kendo Editor Toolbar. */
      formGroup.find('.k-editor-toolbar').append(toolGroup);

      comboBoxControl.kendoDropDownList({
        dataSource: this.templates,
        dataTextField: 'displayName',
        dataValueField: 'id',
        optionLabel: {
          displayName: 'Apply Template...',
          id: '',
        },
        open: function() {
        /* Hides Option Label from DropDownList. */
          comboBoxControl.data('kendoDropDownList').list.find('.k-list-optionlabel').hide();
        },
        change: function() {
          var dataItem = this.dataItem();
          $.ajax({
            url: that.templatesPath + dataItem.id + '.html',
            type: 'GET',
            dataType: 'html',
            async: false,
            contentType: 'application/html; charset=UTF-8',
            success: successHandler,
            error: function(e) {
              displayWarning('Failed to load template for "{0}"', dataItem.displayName);
            },
          });
        },
      }).data('kendoDropDownList');

      function updateEditor(value) {
        var bodyEditor = formGroup.find('.form-editor').data('kendoEditor');
        pageForm.viewModel.set('Body', value);
        /* Triggers editor keyup and change events to simulate user input. */
        bodyEditor.trigger('keyup', {
          currentTarget: bodyEditor.body,
        });
        bodyEditor.trigger('change');
        /* Adds new editor state to undoRedostack. */
        _.defer(function() {
          bodyEditor.exec('inserthtml', {value: ''});
        });
      }

      function displayWarning(message, displayName) {
        var popupNotification = comboBoxControl.kendoNotification({
          height: '80px',
          templates: [{
            type: 'warning',
            template: '<div class=\'warning k-ext-dialog-content\'><div class=\'k-ext-dialog-icon fa fa-warning\'></div><div class=\'k-ext-dialog-message\'>#= message #</div></div>'
          }],
        }).data('kendoNotification');
        popupNotification.show({
          message: message.replace('{0}', displayName),
        }, 'warning');
      }

      function successHandler(data) {
        var template = kendo.template(data);
        /* Creates new date object to make intelligent timestamps replacements in the template code. */
        var currentTime = new Date();
        /* Next update timestamp = current + 1 hour */
        var nTimestamp = currentTime.setHours(currentTime.getHours() + 1);

        var templateModel = {
          timestamp: kendo.toString(new Date(currentTime), 'HH:mm'),
          nextStatus: kendo.toString(new Date(nTimestamp), 'HH:mm'),
        };
        updateEditor(template(templateModel));
      }

      if (!_.isUndefined(this.default)) {
        this.select(that.default);
      }
      return this;
    };

    this.select = function(id) {
      var formGroup = $(this.formSelector);
      var comboBoxControl = formGroup.find('div.k-combobox');
      if (comboBoxControl.length) {
        var toolDropDownList = comboBoxControl.data('kendoDropDownList');
        toolDropDownList.value(id);
        toolDropDownList.trigger('change');
      }
      return this;
    };

    return this.init();
  }
});
}());
/* ------------------------------------------------------- */
/* ---------- End Custom Announcement Templates ---------- */
/* ------------------------------------------------------- */
