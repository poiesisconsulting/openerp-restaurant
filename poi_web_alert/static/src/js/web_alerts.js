openerp.poi_web_alert = function(instance){

    //var module = instance.point_of_sale;
    var _t = instance.web._t,
    _lt = instance.web._lt;

    var QWeb = instance.web.qweb;
    instance.web.alerts =  instance.web.Widget.extend({
        template: 'alerts',
        init: function() {
            this._super.apply(this, arguments);
            this.connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});
            instance.web.alerts = this;
        },
        start: function() {
            this._super.apply(this, arguments);
            this.connect();
        },
        connect: function(){
            var self = this;
            function load_messages(){
                self.connection.rpc('/poi_web_alert/get_alert')
                    .then(function(messages){
                        if (messages){
                            _.each(messages, function(message){
                                self.generate_message(message.id,'bottomRight',message.relevance,message.message);
                            });
                        };
                    }).always(function(){
                        setTimeout(load_messages,10000);
                    });
            };
            load_messages();
        },
        noty: function(options) {
            return $.notyRenderer.init(options);
        },
        generate_message: function(message_id,position,relevance,message) {
            var self = this;

            if (relevance == 'information' || relevance == 'warning'){
                var n = this.noty({
                    text        : message,
                    type        : relevance,
                    dismissQueue: true,
                    layout      : position,
                    theme       : 'defaultTheme',
                });
            }
            else if (relevance == 'notification' || relevance == 'success'){
                var n = this.noty({
                    text        : message,
                    type        : relevance,
                    dismissQueue: true,
                    layout      : position,
                    theme       : 'defaultTheme',
                    timeout     : 5000,
                });
            }
            else if (relevance == 'alert' || relevance == 'error'){
                var n = this.noty({
                    text        : message,
                    type        : relevance,
                    dismissQueue: true,
                    layout      : position,
                    theme       : 'defaultTheme',
                    buttons: [
                        {
                            addClass: 'btn btn-primary', text: _t('Ok'), onClick: function($noty) {

                                // this = button element
                                // $noty = $noty element

                                $noty.close();
                                self.connection.rpc('/poi_web_alert/set_alert_as_read',{'alert_id': message_id});
                            }
                        },
                        {
                            addClass: 'btn btn-danger', text: _t('Remind me later'), onClick: function($noty) {
                                $noty.close();
                                self.connection.rpc('/poi_web_alert/remind_me_later',{'alert_id': message_id});
                                noty({text: _t('You will be reminded in 1 hour'), type: 'error', timeout: 3000});
                            }
                        }
                    ]
                });
            }

            this.connection.rpc('/poi_web_alert/set_alert_as_displayed',{'alert_id': message_id, 'noty_id': n.options.id});
        },
    });


    instance.web.Client = instance.web.Client.include({
        show_common: function() {
            this._super();
            var self = this;
            self.alerts = new instance.web.alerts();
            self.alerts.appendTo(self.$el);
        },

    });

}