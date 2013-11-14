/*
 * A script for Ecwid to display Yotpo widgets on product details pages
 *
 * Project web page: https://github.com/makfruit/ecwid_yotpo_widgets/
 * Ecwid shopping cart: http://www.ecwid.com
 * Yotpo reviews: http://www.yotpo.com
 *
 */

/*
 * EcwidYotpoWidgets module - the main one. It initialize and show Yotpo widget and handle Ecwid events
 * It also provides interfaces to all included modules
 */
var EcwidYotpoWidgets = (function(module) {
  var _config;
  var _activeWidgets = [];

  /*
   * Extend target object with a given source object
   */
  function _extend(target, src, isRecursive) {
    var targetType = typeof (target);
    var srcType = typeof (src);
    if (
      'undefined' == targetType
      || 'undefined' == srcType
    ) {
      return src || target;
    }

    if (target === src) {
      return target;
    }

    if ('object' == srcType) {
      if ('object' != targetType) {
        target = {};
      }
      for (var key in src) {
        if (isRecursive) {
          target[key] = _extend(target[key], src[key], isRecursive);

        } else {
          target[key] = src[key];
        }
      }

    } else {
      target = src;
    }

    return target;
  }

  /*
   * Set configuration
   */
  function _setConfig(userConfig) {
    if (
      typeof userConfig != 'object'
      || !userConfig.yotpoAppKey
    ) {
      EcwidYotpoWidgets.Log.err(EcwidYotpoWidgets.Messages.ERR_YOTPO_APP_KEY_NOT_SET);
      return false;
    }

    _config = _extend(EcwidYotpoWidgets.DefaultConfig, userConfig, true);
  }

  /*
   * Check whether at least one widget is enabled
   */
  function _isEnabled() {
    return (_activeWidgets.length > 0);
  }

  /*
   * Prepare and show widgets on the current page
   */
  function _showProductPageWidgets(ecwidPage) {
    // Get the product information
    var pageInfo = EcwidYotpoWidgets.EcwidApi.getEcwidProductPageInfo(ecwidPage);

    // Show widgets
    for (var i = 0; i < _activeWidgets.length; i++) {
      _activeWidgets[i].show(pageInfo);
    }

    // Initialize Yotpo
    window.yQuery(".yotpo").yotpo();
  }

  /*
   * Prepare and show widgets on the current page
   */
  function _hideProductPageWidgets() {
    // Hide widgets
    for (var i = 0; i < _activeWidgets.length; i++) {
      _activeWidgets[i].hide();
    }
  }

  /*
   * Init Yotpo widgets: 
   *   - create widget objects,
   *   - attach event handlers
   */
  function _start() {
    // Create widget objects
    for (var widgetType in EcwidYotpoWidgets.WIDGET_TYPES) {
      if (_config[widgetType].enabled) {
        _activeWidgets[_activeWidgets.length] = EcwidYotpoWidgets.WidgetsFactory.createWidget(widgetType, _config);
      }
    }
    
    // Initialize widgets    
    if (_isEnabled()) {
      // Define Yotpo app key on the page
      window.yotpo_app_key = _config.yotpoAppKey;

      // Create an empty .yotpo div - a workaround for the strange Yotpo behavior:
      // without it Yotpo doesn't load the first widget on the page
      jQuery(
        "<div></div>", 
        {
          "class": "yotpo",
          "display": "none"
        }
      ).prependTo("body");

      // Attach widgets appearing to Ecwid page loading
      EcwidYotpoWidgets.EcwidApi.attachPageLoadedHandler(_hideProductPageWidgets);
      EcwidYotpoWidgets.EcwidApi.attachProductPageLoadedHandler(_showProductPageWidgets);
    }
  }

  /*
   * The main function: set configuration, initialize and show widgets
   */
  function _load(config) {
    // Check if Ecwid exists on the page
    if (typeof (window.Ecwid) != 'object') {
      EcwidYotpoWidgets.Log.err(EcwidYotpoWidgets.Messages.ERR_NO_ECWID_ON_PAGE);
      return false;
    }

    // Set configuration
    _setConfig(config);

    // Load dependencies and init widgets
    EcwidYotpoWidgets.Loader.load(
      [
        {
          test: window.jQuery,
          sources: ['//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js']
        },
        {
          test: window.yQuery,
          sources: ['//www.yotpo.com/js/yQuery.js']
        }       
      ],
      _start
    );
  }

  // Public
  return (_extend(
    module,
    {
      load: _load,
      extend: _extend
    }
  ));
}(EcwidYotpoWidgets || {}));

/*
 * EcwidYotpoWidgets.Loader module provides functions for checking dependencies, 
 * loading remote scripts and invoking a callback function after all dependencies 
 * are loaded
 */
EcwidYotpoWidgets.Loader = (function(module) {
  var _scripts = [];
  var _numScripts = 0;

  // Final callback (called after all the scripts are loaded)
  var _completeCallback = function() {};  

  /*
   * Callback on script loading
   */
  function _onScriptLoaded() {
    if (--_numScripts <= 0) {
      _completeCallback();
    }
  }

  /*
   * Load external JS script
   */
  var _injectJs = function(src, callback) {
    var script = document.createElement("script");
    script.setAttribute("src", src);
    script.charset = "utf-8";
    script.setAttribute("type", "text/javascript");
    script.onreadystatechange = script.onload = callback;
    document.body.appendChild(script);
  }

  /*
   * Load all dependencies
   */
  var _load = function(dependencies, callback) {
    _completeCallback = callback;
    if (typeof dependencies !== 'undefined') {
      // Test and collect sources for loading
      for (var d = 0; d < dependencies.length; d++) {
        if (
          typeof (dependencies[d].test) === 'undefined'
          && typeof (dependencies[d].sources) === 'object'
        ) {
          for (var s = 0; s < dependencies[d].sources.length; s++) {
            _scripts[_scripts.length] = dependencies[d].sources[s];
          }
        }
      }

      _numScripts = _scripts.length;

      if (_numScripts <= 0) {
        _completeCallback();

      } else {
        for (var i = 0; i < _numScripts; i++) {
          _injectJs(_scripts[i], _onScriptLoaded);
        }
      }

    } else {
      _completeCallback();
    }
  }

  // Public
  return (EcwidYotpoWidgets.extend(
    module,
    {
      load: _load
    }
  ));

})(EcwidYotpoWidgets.Loader || {});

/*
 * EcwidYotpoWidgets.EcwidApi module provides Ecwid-related function (JS API wrappers, 
 * product info parsers and so on)
 */
EcwidYotpoWidgets.EcwidApi = (function(module) {  
  /*
   * Truncate text in product description according to the given limits
   */
  var _truncateProductDescription = function(text, length) {
    text = (text || '') + '';
    if (text.length <= length) {
      return text;
    }
    return (jQuery.trim(text).substring(0, length).split(" ").slice(0, -1).join(" ") + "...");
  }

  /* 
   * Parse the page source and get the product information
   */
  var _getEcwidProductPageInfo = function(ecwidPage) {
    var data = {
      'imageUrl': jQuery('.ecwid-productBrowser-details-thumbnail > img').attr('src'),      
      'title': jQuery('.ecwid-productBrowser-head').text(),
      'descr': jQuery('.ecwid-productBrowser-details-descr').text(),
      'models': "", // no such data
      'id': ecwidPage.productId,
      'domain': document.domain, 
      'url': window.location.href,
      'breadcrumbs': _getBreadcrumbs()
    };   
    return data;
  }

  /*
   * Find and get breadcrumbs (navigation line) on product page
   */
  var _getBreadcrumbs = function() {   
    var categories = [];
    jQuery('div.ecwid-productBrowser-categoryPath-categoryLink:not(.ecwid-productBrowser-categoryPath-storeLink)').each(
      function() {
        categories.push(jQuery(this).text());
      }
    );
    var separator = jQuery('span.ecwid-productBrowser-categoryPath-separator:first').text();
    var breadcrumbs = categories.join(separator);
    return breadcrumbs;
  }

  /*
   * Assign a handler to the Ecwid.OnPageLoaded event
   */
  var _attachPageLoadedHandler = function(callback) {
    Ecwid.OnPageLoaded.add(function(page) {      
      callback(page);
    });
  }

  /*
   * Assign a handler to the Ecwid.OnPageLoaded event
   */
  var _attachProductPageLoadedHandler = function(callback) {
    Ecwid.OnPageLoaded.add(function(page) {
      if (
        typeof (page) == 'object'
        && 'PRODUCT' == page.type
      ) {
        setTimeout(
          function() {            
            callback(page);
          },
          200 // workaround for Ecwid onPageLoaded early firing
        );
      }
    });
  }

  // Public
  return (EcwidYotpoWidgets.extend(
    module,
    {
      attachPageLoadedHandler: _attachPageLoadedHandler,
      attachProductPageLoadedHandler: _attachProductPageLoadedHandler,
      truncateProductDescription: _truncateProductDescription,
      getEcwidProductPageInfo: _getEcwidProductPageInfo
    }
  ));

})(EcwidYotpoWidgets.EcwidApi || {});

/*
 * EcwidYotpoWidgets.Widget module: Abstract Widget
 */
EcwidYotpoWidgets.Widget = (function(module) {  

  module.createHTMLContainer = function(pageInfo) {    
    // Here, 'this' refers to child class    

    // Prepare data attributes for the widget's HTML element
    // Basic information
    var elmAttributes = {
      "id": this.widgetConfig.elmId,
      "class": this.widgetConfig.elmCssClass + " " + this.widgetConfig.elmExtraCssClass,
      "data-appkey": this.globalConfig.yotpoAppKey,
      "data-domain": pageInfo.domain,
      "data-product-id": pageInfo.id,
      "data-product-models": pageInfo.models,
      "data-name": this.escapeText(pageInfo.title),
      "data-url": pageInfo.url,
      "data-image-url": pageInfo.imageUrl,
      "data-description": this.escapeText(pageInfo.descr),
      "data-bread-crumbs": this.escapeText(pageInfo.breadcrumbs)
    };

    // Advanced information. For the details, see http://support.yotpo.com/entries/21732922-Advanced-Widget-Customization    
    EcwidYotpoWidgets.extend(elmAttributes, this.widgetConfig.advancedAttributes);    
  
    // Create an empty div with the defined above attributes
    var widgetElement = jQuery("<div/>").attr(elmAttributes);

    return widgetElement;  
  }

  module.removeHTMLContainer = function() {
    jQuery('#' + this.widgetConfig.elmId).remove(); 
  }

  module.escapeUrl = function(url) {
    return encodeURIComponent(url);
  }

  module.escapeText = function(text) {    
    return EcwidYotpoWidgets.EcwidApi.truncateProductDescription(text, this.globalConfig.productDescrMaxLength);
  }

  /*
   * Mixin function
   */
  function mixin() {
    for (key in module) {
      if (module.hasOwnProperty(key)) {
        this[key] = module[key];
      }
    }
    return this;    
  }

  return mixin;
  
})(EcwidYotpoWidgets.Widget || {});

/*
 * EcwidYotpoWidgets.ReviewsWidget module: Yotpo Reviews Widget (extends Widget)
 */
EcwidYotpoWidgets.ReviewsWidget = function(config) {
  this.widgetType = 'reviews';
  this.globalConfig = config;
  this.widgetConfig = config[this.widgetType];

  var that = this;
  this.show = function(pageInfo) {
    that.removeHTMLContainer();
    var widgetElement = that.createHTMLContainer(pageInfo);

    // Find the element which the reviews widget should be placed after
    var parentElement;
    if (this.widgetConfig.elmParentSelector) {
      // Parent element is set in the config
      parentElement = jQuery(that.widgetConfig.elmParentSelector);

    } else {
      // Find the closest product browser's wrapper with 'ecwid' class
      parentElement = jQuery("." + that.globalConfig.ecwidProductBrowserCssClass).closest('.ecwid');
    }

    // Insert widget's container into the current page
    widgetElement.insertAfter(parentElement);
  }

  this.hide = function() {
    that.removeHTMLContainer();
  }
}
EcwidYotpoWidgets.Widget.call(EcwidYotpoWidgets.ReviewsWidget.prototype);

/*
 * EcwidYotpoWidgets.BottomlineWidget module: Yotpo Bottom Line Widget (extends Widget)
 */
EcwidYotpoWidgets.BottomlineWidget = function(config) {
  this.widgetType = 'bottomline';
  this.globalConfig = config;
  this.widgetConfig = config[this.widgetType];

  var that = this;
  this.show = function(pageInfo) {
    that.removeHTMLContainer();
    var widgetElement = that.createHTMLContainer(pageInfo);
    widgetElement.insertAfter(that.widgetConfig.elmParentSelector);
  }

  this.hide = function() {
    that.removeHTMLContainer();
  }
}
EcwidYotpoWidgets.Widget.call(EcwidYotpoWidgets.BottomlineWidget.prototype);


/*
 * EcwidYotpoWidgets.WidgetsFactory module: Factory of widgets
 */
EcwidYotpoWidgets.WidgetsFactory = (function(module) {
  /*
   * Create an instance of a widget object
   */
  function _createWidget(type, config) {
    if (typeof (type) !== 'string') {
      EcwidYotpoWidgets.Log.wrn(EcwidYotpoWidgets.Messages.WRN_BAD_WIDGET_TYPE);
      return false;
    }

    switch(type) {
      case EcwidYotpoWidgets.WIDGET_TYPES.reviews:
        return new EcwidYotpoWidgets.ReviewsWidget(config);
        break;

      case EcwidYotpoWidgets.WIDGET_TYPES.bottomline:
        return new EcwidYotpoWidgets.BottomlineWidget(config);
        break;
     
      default:
        return new EcwidYotpoWidgets.ReviewsWidget(config);
    }
  }

  return EcwidYotpoWidgets.extend(
    module,
    {
      createWidget: _createWidget
    }
  );

})(EcwidYotpoWidgets.WidgetsFactory || {});


/*
 * EcwidYotpoWidgets.Log module provides functions for status messages 
 * like warnings, errors and simple logs. 
 */
EcwidYotpoWidgets.Log = (function(module) {
  var _PREFIX = "EcwidYotpoWidgets: ";
  var _TYPE_MSG = 1;
  var _TYPE_WRN = 2;
  var _TYPE_ERR = 3;

  /*
   * Prepare and print message
   */
  function _log(message, type) {
    // Prepare message
    message = _PREFIX + message.toString();

    // Detect message type and print it
    switch (type) {
      case _TYPE_MSG:
        EcwidYotpoWidgets.Log.Console.log(message);
        break;

      case _TYPE_WRN:
        EcwidYotpoWidgets.Log.Console.warn(message);
        break;

      case _TYPE_ERR:
        EcwidYotpoWidgets.Log.Console.error(message);
        break;

      default:
        EcwidYotpoWidgets.Log.Console.log(message);
        break;
    }

  }
  
  function _msg(message) {
    _log(message, _TYPE_MSG);
  }

  function _wrn(message) {
    _log(message, _TYPE_WRN);
  }

  function _err(message) {
    _log(message, _TYPE_ERR);
  }

  // Public
  return (EcwidYotpoWidgets.extend(
    module,
    {
      msg: _msg,
      wrn: _wrn,
      dbg: _wrn, // alias for debug
      err: _err
    }
  ));

})(EcwidYotpoWidgets.Log || {});

/*
 * EcwidYotpoWidgets.Log.Console module: wrapper for window.console with fallbacks
 */
EcwidYotpoWidgets.Log.Console = (function(module) {
  var _module = {};
  function _void() {}

  if (typeof window.console == 'undefined') {
    _module = {
      log: _void,
      warn: _void,
      error: _void
    }

  } else {
    _module.log = (
      window.console.log ? 
        function(message) { window.console.log(message) }
        :  _void
    );
    _module.warn = (
      window.console.warn ?
        function(message) { window.console.warn(message) }
        : _module.log
    );
    _module.error = (
      window.console.error ?
        function(message) { window.console.error(message) }
        : _module.log
    );
  }

  // Public
  return (EcwidYotpoWidgets.extend(
    module,
    _module
  ));

})(EcwidYotpoWidgets.Log.Console || {});

/*
 * EcwidYotpoWidgets.WIDGET_TYPES
 */
EcwidYotpoWidgets.WIDGET_TYPES = (function(module) {
  var _module = {    
    reviews: "reviews",
    bottomline: "bottomline"
  }

  return (EcwidYotpoWidgets.extend(module, _module, true));

}(EcwidYotpoWidgets.WIDGET_TYPES || {}));

/*
 * EcwidYotpoWidgets.DefaultConfig module: widgets' default settings.
 */
EcwidYotpoWidgets.DefaultConfig = (function(module) {
  var _config = {    
    yotpoAppKey: '',
    productDescrMaxLength: 300,
    ecwidProductBrowserCssClass: "ecwid-productBrowser",

    reviews: {
      enabled: true,
      elmId: "ecwid_yotpo_reviews",      
      elmParentSelector: false, // widget's parent DOM element
      elmCssClass: "yotpo reviews",
      elmExtraCssClass: "",
      advancedAttributes: {} // The list of custom data attributes
    },

    bottomline: {
      enabled: true,
      elmId: "ecwid_yotpo_bottomline",        
      elmParentSelector: ".ecwid-productBrowser-head", // widget's parent DOM element
      elmCssClass: "yotpo bottomLine",
      elmExtraCssClass: "",
      advancedAttributes: {} // The list of custom data attributes
    }    
  }

  return (EcwidYotpoWidgets.extend(module, _config, true));

}(EcwidYotpoWidgets.DefaultConfig || {}));

/*
 * EcwidYotpoWidgets.Messages module: messages constants
 */
EcwidYotpoWidgets.Messages = (function(module) {
  var _module = {    
    ERR_NO_ECWID_ON_PAGE: "Ecwid isn't found on the page",
    ERR_YOTPO_APP_KEY_NOT_SET: "Yotpo application key is not set",
    ERR_YOTPO_INIT: "Yotpo initialization failed",

    WRN_BAD_WIDGET_TYPE: "Failed to create widget: invalid type"
  }

  return (EcwidYotpoWidgets.extend(module, _module, true));

}(EcwidYotpoWidgets.Messages || {}));
