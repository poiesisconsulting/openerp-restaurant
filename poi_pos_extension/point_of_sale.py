# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################
from datetime import datetime
from dateutil.relativedelta import relativedelta
from decimal import Decimal
import logging
import pdb
import time

import openerp
from openerp import netsvc, tools
from openerp.osv import fields, osv
from openerp.tools.translate import _
_logger = logging.getLogger(__name__)

#ToDo: V8 - Check if this is needed here
class pos_config(osv.osv):
    _inherit = "pos.config"
    
    _columns = {
        'default_partner_id': fields.many2one('res.partner','Default Customer', help='Default customer assigned as NoName'),
        'cash_return_journal_id': fields.many2one('account.journal', 'Journal for returned cash', required=True, domain="[('type','=','cash')]"),
    }
    
pos_config()


class pos_order(osv.osv):
    
    _inherit='pos.order'
    _columns={
        'timestamp': fields.text('Timestamp'),
    }

    #ToDo: Check if this is valid here
    #For some reason this is not being called on deafults.
    #def _default_sale_journal(self, cr, uid, context=None):
    #    company_id = self.pool.get('res.users').browse(cr, uid, uid, context=context).company_id.id
    #    res = self.pool.get('account.journal').search(cr, uid, [('type', '=', 'sale'), ('company_id', '=', company_id)], limit=1, context=context)
    #    return res and res[0] or False

    def merge_orders(self, cr, uid, from_order, into_order):
        #ToDo: Create a generic merge function
        return True
    
    def _fetch_create_ui_values(self, cr, uid, order, context=None):
        values= {
            'name': order['name'],
            'user_id': order['user_id'] or False,
            'session_id': order['pos_session_id'],
            'lines': order['lines'],
            'pos_reference':order['name'],
            'partner_id': order['partner_id'] or False
        }

        #ToDo: Check if this is needed
        #This fixes an error without a partner_id
        #if not order.get('partner_id'):
        #        pos_config_id=self.pool.get('pos.session').browse(cr, uid, order['pos_session_id']).config_id
        #        if pos_config_id.default_partner_id:
        #            values['partner_id']=pos_config_id.default_partner_id.id
        #        else:
        #            raise osv.except_osv( _('error!'),
        #                    _("POS doesn't have a default partner."))
        #if not order.get('sale_journal'):
        #    values['sale_journal'] = self._default_sale_journal(cr, uid, context)
        
        return values
    
    def _fetch_add_payment_values(self, cr, uid, payment, context=None):
        values={
            'amount': payment['amount'] or 0.0,
            'payment_date': payment['name'],
            'statement_id': payment['statement_id'],
            'payment_name': payment.get('note', False),
            'journal': payment['journal_id']
                }
        return values
    
    def _continue_with_payment(self, cr, uid, order, context=None, order_id=None):
        if order:
            return True
        
    def _update_order_data(self, cr, uid, order, context=None):
        return order
        
    #Copied as is from point_of_sale
    def create_from_ui(self, cr, uid, orders, context=None):
        #_logger.info("orders: %r", orders)
        order_ids = []
        for tmp_order in orders:
            to_invoice = tmp_order['to_invoice']
            order = tmp_order['data']

            #Help: This function was created if for some reason someone wants to
            #override some data from the order
            order = self._update_order_data(cr, uid, order, context)

            #Help: This function was created in order to add some data returned from POS UI
            #that can't be added

            values_order = self._fetch_create_ui_values(cr, uid, order, context)

            #New variable values_order is going to store all the values that are going to be created
            order_id = self.create(cr, uid, values_order, context)

            #This in case that someone wants to create only the order
            if self._continue_with_payment(cr, uid, order, context, order_id):
                for payments in order['statement_ids']:
                    payment = payments[2]

                    #Added this because sometimes we need to add some values to each payment.
                    #Check if this is working


                    payment_data=self._fetch_add_payment_values(cr, uid, payment, context)

                    self.add_payment(cr, uid, order_id, payment_data, context=context)

                if order['amount_return']:
                    sessionis = self.pool.get('pos.session').search(cr, uid, [('id','=',order['pos_session_id'])])
                    if not sessionis or len(sessionis)==0:
                        return True
                    session = self.pool.get('pos.session').browse(cr, uid, order['pos_session_id'], context=context)
                    cash_journal = session.cash_journal_id
                    cash_statement = False
                    if not cash_journal:
                        #cash_journal_ids = filter(lambda st: st.journal_id.type=='cash', session.statement_ids)
                        #if not len(cash_journal_ids):
                        #    raise osv.except_osv( _('error!'),
                        #        _("No cash statement found for this session. Unable to record returned cash."))
                        #cash_journal = cash_journal_ids[0].journal_id
                        cash_journal = session.config_id.cash_return_journal_id
                        if not cash_journal:
                            raise osv.except_osv(_('error!'),_("No return journal found for this POS. Unable to record returned cash."))
                    self.add_payment(cr, uid, order_id, {
                        'amount': -order['amount_return'],
                        'payment_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                        'payment_name': _('return'),
                        'journal': cash_journal.id,
                    }, context=context)
                order_ids.append(order_id)

                try:
                    self.signal_paid(cr, uid, [order_id])
                except Exception as e:
                    _logger.error('Could not mark POS Order as Paid: %s', tools.ustr(e))

                if to_invoice:
                    self.action_invoice(cr, uid, [order_id], context)
                    order_obj = self.browse(cr, uid, order_id, context)
                    self.pool['account.invoice'].signal_invoice_open(cr, uid, [order_obj.invoice_id.id])

        return order_ids


    def create(self, cr, uid, vals, context=None):
        vals['timestamp']=str(time.time())
        return super(pos_order, self).create(cr, uid, vals, context=context)

    def avoid_write_fields(self, cr, uid):
        res = ['timestamp','picking_id','state']
        return res

    def write(self, cr, uid, ids, vals, context=None):
        if not context:
            context={}
        flag = False
        if not context.get('no_synch'):
            fields_to_avoid = self.avoid_write_fields(cr, uid)
            for key, value in vals.iteritems():
                if key not in fields_to_avoid:
                    flag = True
                    break
        if flag:
            vals['timestamp']=str(time.time())
        return super(pos_order, self).write(cr, uid, ids, vals, context=context)


    def _fetch_orderline_values(self, cr, uid, orderline, context=None):
        values={'unique_name': orderline.get('unique_name') or '',
                'discount': orderline.get('discount'),
                'price_unit': orderline.get('price_unit'),
                'product_id': orderline.get('product_id'),
                'qty': orderline.get('qty'),
                }
        return values

    def save_orderline_from_ui(self, cr, uid, order_id, orderline_data, context=None):
        if not context:
            context = {}

        context['no_synch'] = True

        if not order_id:
            return True

        pos_line_object = self.pool.get('pos.order.line')
        if orderline_data:
            orderline = orderline_data[0]
            line_properties = self._fetch_orderline_values(cr, uid, orderline, context=context)
            line_properties['order_id'] = order_id
        else:
            return True
        if orderline.get('unique_name'):
            line_ids = pos_line_object.search(cr, uid, [('unique_name','=',orderline.get('unique_name'))])

        if line_ids:
            line_id = line_ids[0]
            #ToDo: Get remove???
            if orderline.get('remove'):
                pos_line_object.unlink(cr, uid, line_id, context=context)
            pos_line_object.write(cr, uid, line_id, line_properties, context=context)
        else:
            pos_line_object.create(cr, uid, line_properties, context=context)


    
pos_order()

class pos_order_line(osv.osv):
    _inherit='pos.order.line'

    _columns={
        'timestamp': fields.text('Timestamp'),
        'unique_name': fields.char('Orderline Unique Name', size=64, required=True, readonly=True),
    }

    def create(self, cr, uid, vals, context=None):
        if not context:
            context = {}
        if not context.get('no_synch'):
            if vals.get('order_id'):
                self.pool.get('pos.order').write(cr, uid, int(vals.get('order_id')), {'timestamp':str(time.time())})
        return super(pos_order_line, self).create(cr, uid, vals, context=context)

    def write(self, cr, uid, ids, vals, context=None):
        if not context:
            context = {}
        if not isinstance(ids, list):
            ids=[ids]
        if not context.get('no_synch'):
            for orderline in self.browse(cr, uid, ids):
                self.pool.get('pos.order').write(cr, uid, orderline.order_id.id, {'timestamp':str(time.time())})
        return super(pos_order_line, self).write(cr, uid, ids, vals, context=context)