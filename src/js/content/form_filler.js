/*global FormError jQuery JSONF Logger Utils state */
/*eslint complexity:0, no-unused-vars: 0, max-params: [2, 5]*/
var FormFiller = {
  error: null,
  // This fills the field with a value
  fill: function(selector, value, beforeData, flags, meta) {

    var domNode = null;
    var fillMethod = null;
    var baseDocument = document;

    state.currentRuleMetadata = meta;

    // Recreate original value for "value" (function or string)
    var parsedValue = JSONF.parse(value);

    // Is the "within" property used and a string?
    // If yes we must do one of the following:
    // - If the selector doesn't resolve -> report error
    // - If the selector matches an iframe -> read DOM of iframe
    // - If the selector matches another element -> change selector to "#within other selector"
    // - If the selector matches multiple elements -> error!
    if (typeof meta !== "undefined" && typeof meta.within === "string") {
      var $within = document.querySelectorAll(meta.within);
      if ($within.length === 0) {
        return new FormError(meta.within, value, chrome.i18n.getMessage("fill_within_not_found", [ meta.within ]));
      } else if ($within.length > 1) {
        return new FormError(meta.within, value, chrome.i18n.getMessage("fill_within_too_many_found", [ meta.within ]));
      }

      $within = $within[0];

      if ($within.nodeName === "IFRAME") {
        // <iframe> -> deep dive
        try {
          baseDocument = $within.contentDocument;
          Logger.info("[form_filler.js] base document changed to <frame> at " + meta.within);
        } catch (exception) {
          // Cross origin policy error?
          if (exception.name === "SecurityError") {
            return new FormError(meta.within, value, chrome.i18n.getMessage("fill_within_security_error", [ meta.within, exception.message ]));
          }
        }
      } else {
        // Other element -> change selector
        selector = meta.within + " " + selector;
        Logger.info("[form_filler.js] Changed selector to be '" + selector + "' because 'within' property was set.");
      }
    }

    // Select nodes from either this page or an iframe
    var domNodes = baseDocument.querySelectorAll(selector);
    if (domNodes.length === 0) {
      return new FormError(selector, value, chrome.i18n.getMessage("fill_field_not_found"));
    }
    Logger.info("[form_filler.js] Filling " + domNodes.length + " fields on the page");

    // Call field specific method on EVERY field found
    //
    // "_fill" + the camelized version of one of these:
    // text , button , checkbox , image , password , radio , textarea , select-one , select-multiple , search
    // email , url , tel , number , range , date , month , week , time , datetime , datetime-local , color
    //
    // eg. _fillDatetimeLocal(value)
    var i;
    var returnValue = null;

    for (i = 0; i < domNodes.length; ++i) {
      domNode = domNodes[i];
      fillMethod = this._fillMethod(domNode);

      // Check for "onlyEmpty" flag and break the loop
      if (flags.onlyEmpty === true && domNode.value !== "") {
        Logger.info("[form_filler.js] Skipped the loop because the target was not empty");
        break;
      }

      // if the value is a function, call it with the jQuery wrapped domNode
      // The value for 'Libs' and 'context' are implicitly passed in by defining them on the sandboxed window object
      if (typeof parsedValue === "function") {
        try {
          parsedValue = parsedValue(jQuery(domNode), beforeData);
        } catch (e) {
          Logger.info("[form_filler.js] Got an exception executing value function: " + parsedValue);
          Logger.info("[form_filler.js] Original exception: " + e);
          Logger.info("[form_filler.js] Original stack: " + e.stack);
          return new FormError(selector, value, chrome.i18n.getMessage("fill_error_value_function", [ JSONF.stringify(e.message) ]));
        }
      }

      // Fill field only if value is not null or not defined
      if (parsedValue !== null && typeof parsedValue !== "undefined") {
        // Fill field using the specialized method or default
        returnValue = fillMethod(domNode, parsedValue, selector) || null;
      }
    }

    // Screenshot?
    if (flags.screenshot !== "undefined" && flags.screenshot !== false) {
      // Only the BG page has the permissions to do a screenshot
      // so here we send it the request to do so
      Logger.info("[form_filler.js] sending request to take a screenshot to bg.js");
      chrome.runtime.sendMessage({action: "takeScreenshot", value: meta, flag: flags.screenshot});
    }

    return returnValue;
  },
  _fillDefault: function(domNode, value) {
    domNode.value = value;
  },
  _fillImage: function(domNode, value) {
    domNode.attributes.getNamedItem("src").value = value;
  },
  _fillCheckbox: function(domNode, value) {
    var setValue;
    if (value === true || domNode.value === value) {
      setValue = true;
    }
    if (value === false) {
      setValue = false;
    }
    domNode.checked = setValue;
  },
  _fillRadio: function(domNode, value) {
    domNode.checked = domNode.value === value;
  },
  _fillSelectOne: function(domNode, value) {
    var i = 0;
    var optionNode = null;

    jQuery(domNode).find("option").each(function() {
      this.selected = (value === this.value);
    });
  },
  _fillSelectMultiple: function(domNode, value) {
    var i = 0;
    var optionNode = null;
    value = Array.isArray(value) ? value : [value];

    jQuery(domNode).find("option").each(function() {
      var that = this;
      this.selected = value.some(function(targetValue) {
        return targetValue === that.value;
      });
    });
  },
  _fillDate: function(domNode, value, selector) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      domNode.value = value;
    } else {
      return new FormError(selector, value, chrome.i18n.getMessage("fill_field_error_date"));
    }
    return null;
  },
  _fillMonth: function(domNode, value, selector) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
      domNode.value = value;
    } else {
      return new FormError(selector, value, chrome.i18n.getMessage("fill_field_error_month"));
    }
    return null;
  },
  _fillWeek: function(domNode, value, selector) {
    if (/^\d{4}-W(0[1-9]|[1-4][0-9]|5[0123])$/.test(value)) {
      domNode.value = value;
    } else {
      return new FormError(selector, value, chrome.i18n.getMessage("fill_field_error_week"));
    }
    return null;
  },
  _fillTime: function(domNode, value, selector) {
    if (/^(0\d|1\d|2[0-3]):([0-5]\d):([0-5]\d)(\.(\d{1,3}))?$/.test(value)) {
      domNode.value = value;
    } else {
      return new FormError(selector, value, chrome.i18n.getMessage("fill_field_error_time"));
    }
    return null;
  },
  _fillDatetime: function(domNode, value, selector) {
    if (/^\d{4}-\d{2}-\d{2}T(0\d|1\d|2[0-3]):([0-5]\d):([0-5]\d)([T|Z][^\d]|[+-][01][0-4]:\d\d)$/.test(value)) {
      domNode.value = value;
    } else {
      return new FormError(selector, value, chrome.i18n.getMessage("fill_field_error_datetime"));
    }
    return null;
  },
  _fillDatetimeLocal: function(domNode, value, selector) {
    if (/^\d{4}-\d{2}-\d{2}T(0\d|1\d|2[0-3]):([0-5]\d):([0-5]\d)(\.(\d{1,3}))?$/.test(value)) {
      domNode.value = value;
    } else {
      return new FormError(selector, value, chrome.i18n.getMessage("fill_field_error_datetime_local"));
    }
    return null;
  },
  _fillColor: function(domNode, value, selector) {
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      domNode.value = value;
    } else {
      return new FormError(selector, value, chrome.i18n.getMessage("fill_field_error_color"));
    }
    return null;
  },
  _typeMethod: function(type) {
    return ("_fill-" + type).replace(/(\-[a-z])/g, function($1) {
      return $1.toUpperCase().replace('-', '');
    });
  },
  _fillMethod: function(domNode) {
    // Look for a method that reflects the "type" attribute
    // of the found field.
    var fillMethod = this[this._typeMethod(domNode.type)];
    // Default is to set the value of the field if
    // no special function is defined for that type
    if (typeof fillMethod !== "function") {
      fillMethod = this._fillDefault;
    }
    return fillMethod;
  }
};

