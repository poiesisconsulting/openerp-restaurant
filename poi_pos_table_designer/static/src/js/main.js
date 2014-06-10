openerp.poi_pos_table_designer = function(instance) {

    var module = instance.point_of_sale;

    poi_table_designer(instance, module);   // import table_designer.js

    poi_pos_load_data(instance, module);    // import pos_load_data.js

    poi_pos_models(instance, module);       // import pos_models.js

    poi_pos_screens(instance, module);      // import pos_screens.js

    poi_pos_synch_orders(instance, module); // import pos_synch.js

    poi_pos_widgets(instance, module);      // import pos_widgets.js

};


