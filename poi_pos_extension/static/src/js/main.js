openerp.poi_pos_extension = function(instance) {

    var module = instance.point_of_sale;

    poi_extension_models(instance, module);     // import models.js

    poi_extension_screens(instance, module);    // import screens.js

    poi_extension_synch(instance, module);      // import synch.js

};
