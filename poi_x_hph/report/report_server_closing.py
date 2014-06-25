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

import time

from openerp.osv import osv
from openerp.report import report_sxw

class server_closing(report_sxw.rml_parse):
    _name = 'report.account.account.balance'

    def __init__(self, cr, uid, name, context=None):
        super(server_closing, self).__init__(cr, uid, name, context=context)
        #self.sum_debit = 0.00
        #self.sum_credit = 0.00
        #self.date_lst = []
        #self.date_lst_string = ''
        #self.result_acc = []
        #self.localcontext.update({
        #    'time': time,
        #    'lines': self.lines,
        #    'sum_debit': self._sum_debit,
        #    'sum_credit': self._sum_credit,
        #    'get_fiscalyear':self._get_fiscalyear,
        #    'get_filter': self._get_filter,
        #    'get_start_period': self.get_start_period,
        #    'get_end_period': self.get_end_period ,
        #    'get_account': self._get_account,
        #    'get_journal': self._get_journal,
        #    'get_start_date':self._get_start_date,
        #    'get_end_date':self._get_end_date,
        #    'get_target_move': self._get_target_move,
        #})
        self.localcontext.update({
            'time': time,
            'get_user_terminal': self._get_user_terminal,
            'get_user_sales': self._get_user_sales,
            'get_user_taxes': self._get_user_taxes,
            'get_user_gratuities': self._get_user_gratuities,
            'get_user_gratuities_perc': self._get_user_gratuities_perc,
            'get_user_number_of_tables': self._get_user_number_of_tables,
            'get_user_number_of_covers': self._get_user_number_of_covers,
            'get_user_average_check': self._get_user_average_check,
            'get_user_method_payments': self._get_user_method_payments,
        })
        self.context = context

    def set_context(self, objects, data, ids, report_type=None):
        new_ids = ids
        if (data['model'] == 'ir.ui.menu'):
            new_ids = 'chart_account_id' in data['form'] and [data['form']['chart_account_id']] or []
            objects = self.pool.get('account.account').browse(self.cr, self.uid, new_ids)
        return super(server_closing, self).set_context(objects, data, new_ids, report_type=report_type)

    def _get_user_terminal(self, form):
        user_id = form['user_id'][0]
        date_start = form['date_start']
        date_end = form ['date_end']

        terminals = []
        terminal_names = ''

        pos_order_obj = self.pool.get('pos.order')
        order_ids = pos_order_obj.search(self.cr, self.uid, [('user_id','=',user_id),('date_order','>=',date_start),('date_order','<=',date_end),('state','in',['paid','invoiced','done'])])
        for order in pos_order_obj.browse(self.cr, self.uid, order_ids):
            terminal_id = order.session_id.user_id.id
            if terminal_id not in terminals:
                terminals.append(terminal_id)

        if terminals:
            for terminal in self.pool.get('res.users').browse(self.cr, self.uid, terminals):
                if terminal_names=='':
                    terminal_names=terminal.name
                else:
                    terminal_names+=' '+terminal.name

        return terminal_names

    def _get_user_taxes(self, form):
        user_id = form['user_id'][0]
        date_start = form['date_start']
        date_end = form ['date_end']
        taxes_total = 0.0

        pos_order_obj = self.pool.get('pos.order')
        order_ids = pos_order_obj.search(self.cr, self.uid, [('user_id','=',user_id),('date_order','>=',date_start),('date_order','<=',date_end),('state','in',['paid','invoiced','done'])])
        for order in pos_order_obj.browse(self.cr, self.uid, order_ids):
            taxes_total+=order.amount_tax

        return taxes_total

    def _get_user_gratuities(self, form):
        user_id = form['user_id'][0]
        date_start = form['date_start']
        date_end = form ['date_end']
        gratuities_total = 0.0

        pos_order_obj = self.pool.get('pos.order')
        order_ids = pos_order_obj.search(self.cr, self.uid, [('user_id','=',user_id),('date_order','>=',date_start),('date_order','<=',date_end),('state','in',['paid','invoiced','done'])])
        for order in pos_order_obj.browse(self.cr, self.uid, order_ids):
            for line in order.lines:
                if line.product_id.id == 5401:
                    gratuities_total+=line.price_subtotal

        return gratuities_total

    def _get_user_gratuities_perc(self, form):
        gratuities = self._get_user_gratuities(form)
        sales = self._get_user_sales(form)
        if sales == 0:
            return 0
        return round(gratuities*100/sales,2)

    def _get_user_sales(self, form):
        user_id = form['user_id'][0]
        date_start = form['date_start']
        date_end = form ['date_end']
        sales_total = 0.0

        pos_order_obj = self.pool.get('pos.order')
        order_ids = pos_order_obj.search(self.cr, self.uid, [('user_id','=',user_id),('date_order','>=',date_start),('date_order','<=',date_end),('state','in',['paid','invoiced','done'])])
        for order in pos_order_obj.browse(self.cr, self.uid, order_ids):
            sales_total+=order.amount_total

        gratuities_total = self._get_user_gratuities(form)
        taxes_total = self._get_user_taxes(form)

        return sales_total - gratuities_total - taxes_total


    def _get_user_number_of_tables(self, form):
        user_id = form['user_id'][0]
        date_start = form['date_start']
        date_end = form ['date_end']
        number_of_tables = 0

        pos_order_obj = self.pool.get('pos.order')
        order_ids = pos_order_obj.search(self.cr, self.uid, [('user_id','=',user_id),('date_order','>=',date_start),('date_order','<=',date_end),('state','in',['paid','invoiced','done'])])
        for order in pos_order_obj.browse(self.cr, self.uid, order_ids):
            number_of_tables+=len(order.table_ids)
        return number_of_tables

    def _get_user_number_of_covers(self, form):
        user_id = form['user_id'][0]
        date_start = form['date_start']
        date_end = form ['date_end']
        number_of_covers = 0

        pos_order_obj = self.pool.get('pos.order')
        order_ids = pos_order_obj.search(self.cr, self.uid, [('user_id','=',user_id),('date_order','>=',date_start),('date_order','<=',date_end),('state','in',['paid','invoiced','done'])])
        for order in pos_order_obj.browse(self.cr, self.uid, order_ids):
            number_of_covers+=order.covers
        return number_of_covers

    def _get_user_average_check(self, form):
        covers = self._get_user_number_of_covers(form)
        sales = self._get_user_sales(form)
        if covers == 0:
            return 0
        return round(sales/covers,2)

    def _get_user_method_payments(self, form):
        user_id = form['user_id'][0]
        date_start = form['date_start']
        date_end = form ['date_end']
        payment_methods = {}

        pos_order_obj = self.pool.get('pos.order')
        order_ids = pos_order_obj.search(self.cr, self.uid, [('user_id','=',user_id),('date_order','>=',date_start),('date_order','<=',date_end),('state','in',['paid','invoiced','done'])])
        for order in pos_order_obj.browse(self.cr, self.uid, order_ids):
            for statement in order.statement_ids:
                journal = statement.journal_id.id
                if payment_methods.get(journal):
                    journal_data = {
                        'name': statement.journal_id.name,
                        'amount': statement.amount + payment_methods[journal]['amount'],
                        'counter': payment_methods[journal]['counter'] + 1
                    }
                    payment_methods[journal] = journal_data
                else:
                    payment_methods[journal] = {
                        'name': statement.journal_id.name,
                        'amount': statement.amount,
                        'counter': 1
                    }

        payment_methods_list = []
        for key, value in payment_methods.iteritems():
            payment_methods_list.append(value)

        return payment_methods_list


class report_server_closing(osv.AbstractModel):
    _name = 'report.poi_x_hph.report_server_closing'
    _inherit = 'report.abstract_report'
    _template = 'poi_x_hph.report_serverclosing'
    _wrapped_report_class = server_closing

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
