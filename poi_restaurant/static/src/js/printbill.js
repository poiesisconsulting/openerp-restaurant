function openerp_restaurant_printbill(instance,module){
    var QWeb = instance.web.qweb;
	var _t = instance.web._t;


    module.Order = module.Order.extend({

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
