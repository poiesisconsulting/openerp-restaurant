// ******************* DAO SYSTEMS LA ********************************************
function openerp_restaurant_screens(instance, module) { //module is instance.point_of_sale
    var QWeb = instance.web.qweb;
    var _t = instance.web._t;

    /*************DAO SYSTEMS LA ************************************************************************/

        //Extendemos el module PaymentScreenWidget para agregar nuestra propia funcionalidad a ciertos métodos
    module.PaymentScreenWidget = module.PaymentScreenWidget.extend({

        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.PayMode = {
                Other: 0,
                Cash: 1,
                CreditCard: 2
            }
        },

        render_paymentline: function (line) {
            var el_node = this._super(line); //Llama al metodo render_paymentline de la clase base point_of_sales/screens.js
            var self = this;


            _.each(this.pos.cashregisters, function (cashregister) {

                var button = null;
                if (cashregister.journal.code == 'CCM') {
                    button = $(QWeb.render('PaymentLineButtonCreditCard'));
                    button.click(function () {
                        self.Onpaymentlinebuttonclick(self, {
                                mode: self.PayMode.CreditCard,
                                //code:'CCM'
                                code: cashregister.journal.code
                            },
                            this,
                            cashregister,
                            line
                        );
                    });
                } else if (cashregister.journal.code == 'Cash') {
                    button = $(QWeb.render('PaymentLineButtonCash'));
                    button.click(function () {
                        self.Onpaymentlinebuttonclick(self, {
                                mode: self.PayMode.Cash,
                                //code:'Cash'
                                code: cashregister.journal.code
                            },
                            this,
                            cashregister,
                            line
                        );
                    });
                }

                // POIESIS CODE: hidding S&P button ///////////////
                else if (cashregister.journal.code == 'S & P') {
                    button = false;
                }
                ///////////////////////////////////////////////////

                else {
                    button = $(QWeb.render('PaymentLineButtonOthers', {code: cashregister.journal.code}));
                    button.click(function () {
                        self.Onpaymentlinebuttonclick(self, {
                                mode: self.PayMode.Other,
                                //code:'Cash'
                                code: cashregister.journal.code
                            },
                            this,
                            cashregister,
                            line
                        );
                    });
                }

                if (button){// POIESIS CODE: Validation to exclude S&P button ///////////////
                    button.appendTo(el_node.querySelector('.paymentline-buttons-extend'));
                }
            });


            return el_node;
        },

        Onpaymentlinebuttonclick: function (self, paymode, btn, cashregister, line) {

            //Cambiar el el cash register de la Linea
            line.cashregister = cashregister;
            line.name = cashregister.journal_id[1];

            //el btn podria tener una atributo con el Code del Journal utilizado....
            //o por el mode, buscar del ._.each(this.pos.cashregisters,function(cashregister) {
            var amount = $(btn).parent().parent().find('.paymentline-input:first').val();
            var tips = $(btn).parent().parent().find('.paymentline-input:last').val();
            //console.log('BOTON CLICK',btn);

            //if (paymode.mode==this.PayMode.Cash){
            //    alert('PAGANDO con CASH el MONTO: ' + amount);
            //}else if (paymode.mode==this.PayMode.CreditCard){
            //    alert('PAGANDO con CREDIT CARD el MONTO: ' + amount);
            //}else {
            //    alert('PAGANDO con OTHER el MONTO: ' + amount );
            //}

            //alert('TIPS: ' + tips);
            //alert('CODIGO: ' + paymode.code);


        },

        update_payment_summary: function () {
            //La Base ya hace la suma de PAID y el REMAINIG, esta funcion extendida, obtiene la SUma de TIPS
            //this._super();
            var currentOrder = this.pos.get('selectedOrder');
            // DAO SYSTEMS LA
            var TipsTotal = currentOrder.getTipsTotal();
            //********************
            // DAO SYSTEMS LA
            this.$('.payment-paid-total-tips').html(this.format_currency(TipsTotal));
            //***********************


            //COPIA de la funcion base, que ahora se debe tomar en cuenta el TIP
            var paidTotal = currentOrder.getPaidTotal() - TipsTotal;
            var dueTotal = currentOrder.getTotalTaxIncluded();
            var remaining = dueTotal > paidTotal ? dueTotal - paidTotal : 0;
            var change = paidTotal > dueTotal ? paidTotal - dueTotal : 0;


            this.$('.payment-due-total').html(this.format_currency(dueTotal));
            this.$('.payment-paid-total').html(this.format_currency(paidTotal));
            this.$('.payment-remaining').html(this.format_currency(remaining));
            this.$('.payment-change').html(this.format_currency(change));

            if (currentOrder.selected_orderline === undefined) {
                remaining = 1;  // What is this ?
            }

            if (this.pos_widget.action_bar) {
                this.pos_widget.action_bar.set_button_disabled('validation', !this.is_paid());
                this.pos_widget.action_bar.set_button_disabled('invoice', !this.is_paid());
            }


        },
        is_paid: function () {
            var currentOrder = this.pos.get('selectedOrder');

            return (currentOrder.getTotalTaxIncluded() < 0.000001
                || currentOrder.getPaidTotal() + 0.000001 >= currentOrder.getTotalTaxIncluded());

        },
        prevalidate_order: function(){

            this._super();

            if (!this.validated){
                return;
            }
            else
            {
                var self = this;
                var currentOrder = this.pos.get('selectedOrder');

                //Adicionar el Producto TIPS a la Orden
                //Agregar un Product TIP
                //TODO: Jalar tips de forma configurable!!
                var Product_Tips_ID = 5401;
                var product = self.pos.db.get_product_by_id(parseInt(Product_Tips_ID));
                if (!product) {
                    alert("Doesn't exist the producto 'Tips'");
                    return;
                }
                ;
                // /console.log("Val ORder Product",product);

                // console.log("Val ORder currentOrder",currentOrder);
                var TotalTips = currentOrder.getTipsTotal();
                // console.log("Val ORder TotalTips", TotalTips);
                // Al producto monto agregarle la suma de los Tips.


                //currentOrder.addProduct(product, {price:TotalTips});
                product.price = TotalTips;
                product.list_price = TotalTips;
                currentOrder.addProduct(product);


                // se debe mandar a la cocina.... jajjaja para poder registrar el producto tips, como en el Multirpint.js

                (new instance.web.Model('pos.order')).get_func('send_to_kitchen_from_ui')([currentOrder.exportAsJSON()]).then(function (order_id) {
                    currentOrder.attributes.id = order_id[0];
                    var lines = currentOrder.get_all_lines();
                    //if(lines == ''){
                    //    alert('There are no lines to tip.');
                    //}
                    for (idx in lines) {
                        lines[idx].id = order_id[1][idx];
                    }

                    //currentOrder.printChanges();
                    currentOrder.saveChanges();
                    self.pos_widget.order_widget.update_summary();
                    self.validated = true;
                    //currentOrder.set_order_tables_state('order_taken');

                });
            }
        },
    });

}