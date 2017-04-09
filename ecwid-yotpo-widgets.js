/*
 * Ecwid Yotpo Widgets v0.3.0
 * 
 * A script for Ecwid to display Yotpo widgets on store pages
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
   * Load configurations
   */
  function _loadConfig(callback) {
    var script = document.createElement("script");
    script.setAttribute("src", '//s3.amazonaws.com/yotpo-plugins/ecwid/config/' + Ecwid.getOwnerId() + '.js');
    script.charset = "utf-8";
    script.setAttribute("type", "text/javascript");
    script.onreadystatechange = script.onload = function() {
      if (window.yotpoConfigs) {
        _setConfig(window.yotpoConfigs);
        callback.call();
      }
    }
    document.body.appendChild(script);
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
  function _showWidgets(ecwidPage) {
    // Get the current page information    
    pageInfo = EcwidYotpoWidgets.EcwidApi.getEcwidPageInfo(ecwidPage);

    // Show widgets
    for (var i = 0; i < _activeWidgets.length; i++) {
      if (_activeWidgets[i].isDisplayedOnPage(pageInfo.type)) {        
        _activeWidgets[i].show(pageInfo);
      }
    }

    // Initialize Yotpo
    window.yotpo.initWidgets();
  }

  /*
   * Hide widgets on the current page
   */
  function _hideWidgets() {
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
      // Hide widgets every time an Ecwid page loads
      EcwidYotpoWidgets.EcwidApi.attachPageLoadedHandler(_hideWidgets);

      // Show widgets on products pages
      EcwidYotpoWidgets.EcwidApi.attachPageLoadedHandler(_showWidgets, 'PRODUCT');

      // Show widgets on category pages. 
      // (Ecwid refreshes its layout on product listing pages after loading hence the delay as a workaround)
      EcwidYotpoWidgets.EcwidApi.attachPageLoadedHandler(
        _showWidgets, 
        ['CATEGORY','SEARCH'], 
        _config.productListUpdateDelay
      ); 
    }
  }

  /*
   * The main function: set configuration, initialize and show widgets
   */
  function _load() {
    _loadConfig(function() {
      // Load dependencies and init widgets
      EcwidYotpoWidgets.Loader.load(
        [
          {
            test: window.jQuery,
            sources: ['//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js']
          },
          {
            test: window.yotpo,
            sources: ['//w2.yotpo.com/' + _config.yotpoAppKey + '/widget.js']
          }
        ],
        _start
      );
    });
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
  var _isCompleteCallbackFired = false;

  // Final callback (called after all the scripts are loaded)
  var _completeCallback = function() {};  

  /*
   * Callback on script loading
   */
  function _onScriptLoaded() {

    if (
      !_isCompleteCallbackFired
      && --_numScripts <= 0
    ) {
      _isCompleteCallbackFired = true;
      _completeCallback();
    }
  }

  /* 
   * Detects if the script file is loaded by script.readyState
   * Copied from: https://github.com/SlexAxton/yepnope.js
   */
  function isFileReady (readyState) {
    // Check to see if any of the ways a file can be ready are available as properties on the file's element
    return ( ! readyState || readyState == "loaded" || readyState == "complete" || readyState == "uninitialized" );
  }

  /*
   * Load external JS script
   */
  var _injectJs = function(src, callback) {
    var script = document.createElement("script");
    script.setAttribute("src", src);
    script.charset = "utf-8";
    script.setAttribute("type", "text/javascript");
    script.onreadystatechange = script.onload = function() {
      if (isFileReady(script.readyState)) {
        callback();
      }
    }
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
  var _getEcwidPageInfo = function(ecwidPage) {
    var pageData = {};
    switch(ecwidPage.type) {
      case 'PRODUCT':
        pageData = {
          'imageUrl': jQuery('.ecwid-productBrowser-details-thumbnail > img').attr('src'),      
          'title': jQuery('.ecwid-productBrowser-head').text(),
          'descr': jQuery('.ecwid-productBrowser-details-descr').text(),
          'models': "", // no such data          
          'domain': document.domain, 
          'url': window.location.href,
          'breadcrumbs': _getBreadcrumbs()
        }; 
        break; 

      default:
        break; 
    }
    
    return EcwidYotpoWidgets.extend(ecwidPage, pageData);
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
   * Attach a handler to EcwidYotpoWidgets.EcwidApi.OnPageLoaded event
   */
  var _attachPageLoadedHandler = function(callback, pageType, delay) {    
    var handler;    
    if (pageType) {
      if (!jQuery.isArray(pageType)) {
        pageType = new Array(pageType);
      }
      handler = function(page) {
        if (jQuery.inArray(page.type, pageType) > -1) {
          callback(page);
        }
      };

    } else {
      handler = function(page) {
        callback(page);
      };
    }
    
    EcwidYotpoWidgets.EcwidApi.OnPageLoaded.add(function(page) {
      if (delay) {
        // Add delay if needed
        setTimeout(
          function() {
            handler(page);
          }, 
          delay
        );

      } else {
        handler(page);
      }
    });
  }

  /**
   * Provides a functionality for on page loaded event
   */
  var _OnPageLoaded = (function(module) {
    /**
     * Private variables
     */
    var currentPage = null;
    var callbacks = [];

    /**
     * Trigger on page loaded event
     */
    var _trigger = function(page) {
      currentPage = page;
      callbacks.forEach(function(callback) {
        callback(page);
      });
    }

    /**
     * Add callbacks to event
     */
    var _add = function(callback) {
      callbacks.push(callback);
      if (currentPage) {
        callback(currentPage);
      }
    }

    return (EcwidYotpoWidgets.extend(
      module,
      {
        trigger: _trigger,
        add: _add
      }
    ));
  })({});

  // Public
  return (EcwidYotpoWidgets.extend(
    module,
    {
      attachPageLoadedHandler: _attachPageLoadedHandler,
      truncateProductDescription: _truncateProductDescription,
      getEcwidPageInfo: _getEcwidPageInfo,
      OnPageLoaded: _OnPageLoaded
    }
  ));

})(EcwidYotpoWidgets.EcwidApi || {});

/*
 * EcwidYotpoWidgets.Widget module: Abstract Widget
 */
EcwidYotpoWidgets.Widget = (function(module) { 

  module.isDisplayedOnPage = function(pageType) {
    return (jQuery.inArray(pageType, this.widgetConfig.pages) > -1);
  }

  module.createHTMLContainer = function(addAttributes) {    
    // Here, 'this' refers to child class    

    // Prepare data attributes for the widget's HTML element
    // Basic information
    var elmAttributes = {      
      "class": this.getCssClass()
    };

    // Widget-specific and page-specific attributes
    EcwidYotpoWidgets.extend(elmAttributes, addAttributes);

    // Advanced information
    EcwidYotpoWidgets.extend(elmAttributes, this.widgetConfig.advancedAttributes);
  
    // Create and return an empty div with the defined above attributes
    return jQuery("<div/>").attr(elmAttributes);
  }

  module.getCssClass = function () {
    return this.widgetConfig.elmCssClass + " " + this.widgetConfig.elmExtraCssClass;
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

  this.show = function(pageInfo) {
    // Create an HTML element for the widget and set attributes for it
    var widgetElement = this.createHTMLContainer({
      "id": this.widgetConfig.elmId,      
      "data-domain": pageInfo.domain,      
      "data-product-id": pageInfo.productId,
      "data-product-models": pageInfo.models,
      "data-name": this.escapeText(pageInfo.title),
      "data-url": pageInfo.url,
      "data-image-url": pageInfo.imageUrl,
      "data-description": this.escapeText(pageInfo.descr),
      "data-bread-crumbs": this.escapeText(pageInfo.breadcrumbs)
    });

    // Find the element which the reviews widget should be placed after
    var parentElement;
    if (this.widgetConfig.elmParentSelector) {
      // Parent element is set in the config
      parentElement = jQuery(this.widgetConfig.elmParentSelector);

    } else {
      // Find the closest product browser's wrapper with 'ecwid' class
      parentElement = jQuery("." + this.globalConfig.ecwidProductBrowserCssClass).closest('.ecwid');
    }

    // Insert widget's container into the current page
    widgetElement.insertAfter(parentElement);
  }

  this.hide = function() {
    jQuery('#' + this.widgetConfig.elmId).remove();
  }

  this.escapeText = function(text) {    
    return EcwidYotpoWidgets.EcwidApi.truncateProductDescription(text, this.globalConfig.productDescrMaxLength);
  }

}
EcwidYotpoWidgets.Widget.call(EcwidYotpoWidgets.ReviewsWidget.prototype);

/*
 * EcwidYotpoWidgets.RatingWidget module: Yotpo Star Rating (Bottom Line) Widget (extends Widget)
 */
EcwidYotpoWidgets.RatingWidget = function(config) {
  this.widgetType = 'rating';
  this.globalConfig = config;
  this.widgetConfig = config[this.widgetType];
  
  this.show = function(pageInfo) {
    // Create an HTML element for the widget and set attributes for it
    var widgetElement = this.createHTMLContainer({
      "id": this.widgetConfig.elmId,      
      "data-product-id": pageInfo.productId
    });
    
    // Insert widget into the page
    widgetElement.insertAfter(this.widgetConfig.elmParentSelector);
  }

  this.hide = function() {
    jQuery('#' + this.widgetConfig.elmId).remove();
  }
}
EcwidYotpoWidgets.Widget.call(EcwidYotpoWidgets.RatingWidget.prototype);


/*
 * EcwidYotpoWidgets.RatingListWidget module: Yotpo Star Rating (Bottom Line) Widgets for product list (extends Widget)
 */
EcwidYotpoWidgets.RatingListWidget = function(config) {
  this.widgetType = 'ratinglist';
  this.globalConfig = config;
  this.widgetConfig = config[this.widgetType];

  /*
   * Remove widget HTML containers [override]
   */
  this.removeHTMLContainer = function() {
    jQuery("[class='" + this.getCssClass() + "']").remove();
  }

  this.show = function(pageInfo) {
    var that = this;
    jQuery(this.widgetConfig.elmParentSelector).each(function() {
      // Get product ID from the link      
      var productID = jQuery(this).find('a').attr('href').match("\/shop\/.+-p(.+)")[1];

      // Create an HTML container for star rating widget and sett attributes for it
      var widgetElement = that.createHTMLContainer({
        "data-product-id": productID,
        "data-skip-average-score": true
      });

      // Insert widget into the page
      widgetElement.insertAfter(jQuery(this));
    });
  }

  this.hide = function() {
    jQuery("[class='" + this.getCssClass() + "']").remove();
  }
}
EcwidYotpoWidgets.Widget.call(EcwidYotpoWidgets.RatingListWidget.prototype);

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

      case EcwidYotpoWidgets.WIDGET_TYPES.rating:
        return new EcwidYotpoWidgets.RatingWidget(config);
        break;

      case EcwidYotpoWidgets.WIDGET_TYPES.ratinglist:
        return new EcwidYotpoWidgets.RatingListWidget(config);
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
    rating: "rating",
    ratinglist: "ratinglist"
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
    productListUpdateDelay: 500, // in ms

    reviews: {
      enabled: true,
      pages: ['PRODUCT'],
      elmId: "ecwid_yotpo_reviews",      
      elmParentSelector: false, // widget's parent DOM element
      elmCssClass: "yotpo yotpo-main-widget",
      elmExtraCssClass: "",
      advancedAttributes: {} // The list of custom data attributes
    },

    rating: {
      enabled: true,
      pages: ['PRODUCT'],
      elmId: "ecwid_yotpo_rating",        
      elmParentSelector: ".ecwid-productBrowser-head", // widget's parent DOM element
      elmCssClass: "yotpo bottomLine",
      elmExtraCssClass: "",
      advancedAttributes: {} // The list of custom data attributes
    },

    ratinglist: {
      enabled: true,
      pages: ['CATEGORY', 'SEARCH'],
      elmParentSelector: "div.ecwid-productBrowser-productNameLink", // widget's parent DOM element
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

// Check if Ecwid exists on the page
if (typeof (window.Ecwid) != 'object') {
  EcwidYotpoWidgets.Log.err(EcwidYotpoWidgets.Messages.ERR_NO_ECWID_ON_PAGE);
} else {
  Ecwid.OnAPILoaded.add(function() {
    EcwidYotpoWidgets.load();
  });
  Ecwid.OnPageLoaded.add(function(page) {
    EcwidYotpoWidgets.EcwidApi.OnPageLoaded.trigger(page);
  });
}