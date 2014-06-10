function openerp_restaurant_printbill(instance,module){
    var QWeb = instance.web.qweb;
	var _t = instance.web._t;


    module.Order = module.Order.extend({
        exportforprinting_hook2: function(){
            var orderlines = [];
            this.get('orderLines').each(function (orderline) {
                orderlines.push(orderline.export_for_printing());
            });

            //DAO SYSTEMS
            var table_ids = this.get('table_ids');
            var tables = this.pos.get_tables_code(table_ids);
            var creationDate = this.get('creationDate'); //Este retorna una datetime
            var myTime = this.get_Time_ToString(creationDate);

            var groupOrderLines = this.get_DAO_GroupBy(orderlines, function (item) {
                //console.log('ITEM GROUP', item);
                return [item.product_name, item.discount];
            });
            var reOrderLines = [];
            //Reorganizar los datos

            for (var i = 0; i < groupOrderLines.length; i++) {
                var subArray = groupOrderLines[i];
                var obj = {
                    'discount': subArray[0].discount,
                        'unit_name': subArray[0].unit_name,
                        'product_name': subArray[0].product_name,
                        'price': subArray[0].price,
                        'price_with_tax': subArray.map(function(item){
                                                        return item.price_with_tax;
                                                    }).reduce(function(a,b){
                                                                return a+b;
                                                            },0),
                        'price_without_tax': subArray.map(function(item){
                                                return item.price_without_tax;
                                            }).reduce(function(a,b){
                                                        return a+b;
                                                    },0),
                        'price_display': subArray.map(function(item){
                                                return item.price_display;
                                            }).reduce(function(a,b){
                                                        return a+b;
                                                    },0),
                        'tax': subArray.map(function(item){
                                                return item.tax;
                                            }).reduce(function(a,b){
                                                        return a+b;
                                                    },0),
                        'quantity': subArray.map(function (item) {
                        return item.quantity;
                    }).reduce(function (a, b) {
                        return a + b;
                    }, 0),
                        'seat': subArray.map(function (item) {
                        return item.seat;
                    }).join()
                };

                //obj.price_display *= obj.quantity;

                reOrderLines.push(obj);
            };

            //******************
            return {
                //DAO SYSTEMS
                DAO: {
                    table: tables,
                    creationDate: creationDate,
                    groupOrderLines: reOrderLines,
                    time: myTime
                }
                //*********************
            }
        },
        get_Time_ToString: function (date) {

            var myTime = date.toLocaleDateString();
            var h = date.getHours();
            var daytime = 'am';
            if (h > 11) {
                daytime = 'pm';
            }
            if (h > 12) {
                h -= 12;
            }

            h = h.toString();
            if (h.length == 1) {
                h = '0' + h;
            }
            myTime += ' ' + h;

            myTime += ':';

            if (date.getMinutes().toString().length == 1) {
                myTime += '0';
            }

            myTime += date.getMinutes().toString();
            myTime += daytime;

            return myTime;
        },
    });

    module.PosWidget.include({
        build_widgets: function(){
            var self = this;
            this._super();

            if(this.pos.config.iface_printbill){
                var printbill = $(QWeb.render('PrintBillButton'));

                printbill.click(function(){
                    var order = self.pos.get('selectedOrder');
                    if(order.get('orderLines').models.length > 0){
                        var receipt = order.export_for_printing();
                        console.log('BillReceipt', receipt);
                        self.pos.proxy.print_receipt(QWeb.render('BillReceipt',{
                            receipt: receipt, widget: self,
                        }));
                        order.save_lines_on_db();
                    }
                });

                printbill.appendTo(this.$('.control-buttons'));
                this.$('.control-buttons').removeClass('oe_hidden');
            }
        },
    });
}
