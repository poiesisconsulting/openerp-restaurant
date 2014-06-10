openerp.poi_restaurant = function(instance){

    var module = instance.point_of_sale;

    openerp_restaurant_multiprint(instance,module);

    openerp_restaurant_courseprint(instance,module);

    openerp_restaurant_splitbill(instance,module);

    openerp_restaurant_printbill(instance,module);

    openerp_restaurant_screens(instance,module);

    openerp_restaurant_widgets(instance,module);

};
