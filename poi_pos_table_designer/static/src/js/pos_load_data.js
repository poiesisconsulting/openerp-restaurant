function poi_pos_load_data(instance, module){

    var QWeb = instance.web.qweb;
	_t = instance.web._t;


    var OldPosModel = module.PosModel;

    module.PosModel = module.PosModel.extend({
        load_server_data: function(){
            var self = this;
            this.tables_loaded = $.Deferred();

            var loaded = OldPosModel.prototype.load_server_data.call(this).then(function(){
                return self.fetch(
                    'table.area',
                    ['name','table_ids'],
                    []
                );
            }).then(function(areas_data){
                self.areas_list=areas_data;
                return self.fetch(
                    'table.table',
                    [],
                    []
                );
            }).then(function(tables_data){
                self.tables_list=tables_data;
                self.tables_loaded.resolve();
            });

            return loaded;
        },
    });


	//Grover Notes:
	//Widget created to try to pull data without copying entire PosModel
	module.PropertiesLoadData = module.PosBaseWidget.extend({
		init: function(parent, options){
        	var self = this;
            var options = options || {};
            this._super(parent,options);

            this.pos.properties_loaded = $.Deferred();

            $.when(this.load_server_data())
                .done(function(){
                    //self.log_loaded_data(); //Uncomment if you want to log the data to the console for easier debugging
                	self.pos.properties_loaded.resolve();
                }).fail(function(){
                    //we failed to load some backend data, or the backend was badly configured.
                    //the error messages will be displayed in PosWidget
                    self.pos.properties_loaded.reject();
                });
        },

        load_server_data: function(){
            /*
            var self = this;
			var loaded = self.pos.fetch(
                    'product.product',
                    ['name', 'list_price','price','public_categ_id', 'taxes_id', 'ean13', 'default_code','property_ids',
                     'to_weight', 'uom_id', 'uos_id', 'uos_coeff', 'mes_type', 'description_sale', 'description', 'is_customizable', 'course_sequence'],
                    [['sale_ok','=',true],['available_in_pos','=',true]],
                    {pricelist: self.pos.pricelist.id} // context for price
                ).then(function(products){
                self.pos.db.add_products(products);
                return self.pos.fetch('product.property',
                    ['name','product_attribute_ids', 'single_choice']
                    );
                }).then(function(property){
                    self.pos.set('property', property);
                    return self.pos.fetch('product.product.property.rel',['product_id','property_id']);
                }).then(function(property_rel){
                    self.pos.set('property_rel', property_rel);
                });
            return loaded;
            */
        },
	});

}