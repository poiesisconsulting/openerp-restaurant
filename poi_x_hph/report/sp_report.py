# -*- coding: utf-8 -*-
# #############################################################################
#
# OpenERP, Open Source Management Solution
# Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
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

TOTALS = {}


class sp_report_functions(report_sxw.rml_parse):
    _name = 'report.account.account.balance'

    def __init__(self, cr, uid, name, context=None):
        super(sp_report_functions, self).__init__(cr, uid, name, context=context)

        self.localcontext.update({
            'get_total_food_sp': self._get_total_food_sp,
            'get_total_liquor_sp': self._get_total_liquor_sp,
            'get_total_cocktail_sp': self._get_total_cocktail_sp,
            'get_total_wine_sp': self._get_total_wine_sp,
            'get_total_beer_sp': self._get_total_beer_sp,
            'get_total_nonalcoholic_sp': self._get_total_nonalcoholic_sp,
            'get_total_beverage_sp': self._get_total_beverage_sp,
            'get_total_misc_sp': self._get_total_misc_sp,
            'get_total_sales_sp': self._get_total_sales_sp,
            'get_total_taxes': self._get_total_taxes,
            'get_total_gratuities': self._get_total_gratuities,
            'get_total_collected': self._get_total_collected,
            'get_n_of_checks': self._get_n_of_checks,
            'get_n_of_covers': self._get_n_of_covers,
            'get_average_check': self._get_average_check,
            'get_average_cover': self._get_average_cover,

            'get_sp_orders': self._get_sp_orders,
            'get_total_order': self._get_total_order,

        })

        global TOTALS
        TOTALS['collected'] = 0.00
        TOTALS['checks'] = 0.00
        TOTALS['covers'] = 0.00
        TOTALS['sp_amount'] = 0.00
        TOTALS['all_products'] = 0.00
        TOTALS['tax'] = 0.00
        TOTALS['gratuities'] = 0.00
        TOTALS['food'] = 0.00
        TOTALS['liquor'] = 0.00
        TOTALS['cocktails'] = 0.00
        TOTALS['wine'] = 0.00
        TOTALS['beer'] = 0.00
        TOTALS['non_alcoholic'] = 0.00
        TOTALS['beverage'] = 0.00
        TOTALS['misc'] = 0.00

        self.context = context

    def set_context(self, objects, data, ids, report_type=None):
        new_ids = ids
        if data['model'] == 'ir.ui.menu':
            new_ids = 'chart_account_id' in data['form'] and [data['form']['chart_account_id']] or []
            objects = self.pool.get('account.account').browse(self.cr, self.uid, new_ids)
        return super(sp_report_functions, self).set_context(objects, data, new_ids, report_type=report_type)

    def _get_sp_orders(self, form):
        global TOTALS
        start_date = form['start_date'] + ' 00:00:00'
        end_date = form['end_date'] + ' 23:59:59'
        sp_journal_id = self.pool.get("pos.order").fetch_sp_journal_id(self.cr, self.uid)  # at Bacchanal --> 12

        self.cr.execute("""
            SELECT ord.id as "id",
                date(ses.start_at) as "session_date",
                ord.name as "order_name",
                ord.covers as "covers",
                usr_close.name as "closed_by",
                ord.tables as "tables",
                sp.reason as "sp_reason",
                bsl.amount as "sp_amount"

            FROM account_bank_statement bs

            JOIN account_bank_statement_line bsl
                ON bs.journal_id = '%s'
                AND bsl.statement_id = bs.id
                --AND bsl.amount > 0

            JOIN pos_order ord
                ON bsl.pos_statement_id = ord.id

            JOIN pos_session ses
                ON ses.id = ord.session_id
                AND ses.start_at >= '%s' AND ses.start_at <= '%s'

            JOIN res_users usrs
                ON usrs.id = ord.user_id

            JOIN res_partner usr_close
                ON usr_close.id = usrs.partner_id

            left outer JOIN pos_sales_promotions sp
                ON sp.id = ord.sal_prom

            ORDER BY "session_date" asc
        """ % (sp_journal_id, start_date, end_date))

        orders = self.cr.dictfetchall()
        for order in orders:
            TOTALS['checks'] += 1
            TOTALS['covers'] += order['covers']
            tot_order = self._get_total_order(order['id'])

            order['tot_no_tax'] = tot_order['tot_no_tax']
            order['tot_w_tax'] = tot_order['tot_w_tax']
            order['n_lines'] = tot_order['n_lines']
            if tot_order['tot_w_tax'] == 0:
                order['sp_percentage'] = "%.2f" % 100.00
            else:
                order['sp_percentage'] = "%.2f" % ((order['sp_amount'] / tot_order['tot_w_tax']) * 100)

        return orders

    def _get_total_order(self, order_id):
        tot_no_tax = 0.00
        tot_w_tax = 0.00
        n_lines = 0

        for line in self._get_lines_in_order(order_id):
            tot_no_tax += line.price_subtotal
            tot_w_tax += line.price_subtotal_incl
            n_lines += 1

        return {
            'tot_no_tax': tot_no_tax,
            'tot_w_tax': tot_w_tax,
            'n_lines': n_lines
        }

    def _get_lines_in_order(self, order_id):
        pos_order_line_obj = self.pool.get("pos.order.line")
        order_line_ids = pos_order_line_obj.search(self.cr, self.uid, [('order_id', '=', order_id)])
        order_lines = pos_order_line_obj.browse(self.cr, self.uid, order_line_ids)

        return order_lines

    def _get_product_in_line(self, prod_id):
        product_product_obj = self.pool.get('product.product')
        product_template_obj = self.pool.get('product.template')

        product = product_product_obj.browse(self.cr, self.uid, prod_id)

        prod_tmp_id = product.product_tmpl_id.id
        product_template = product_template_obj.browse(self.cr, self.uid, prod_tmp_id)

        return [product, product_template]

    def _get_categories_string(self, product):
        product_public_category_obj = self.pool.get('product.public.category')

        cat_id = product[1].public_categ_id.id
        cat_str = []
        while cat_id:
            category = product_public_category_obj.browse(self.cr, self.uid, cat_id)
            cat_str.append([cat_id, category.name])

            cat_id = category.parent_id.id
        return cat_str

    def _has_category(self, product, cat_name):
        for cat in self._get_categories_string(product):
            if cat[1].upper() == cat_name.upper():
                return True
        return False

    def _get_totals(self, form):
        global TOTALS

        for order in self._get_sp_orders(form):
            TOTALS['collected'] += order['sp_amount']
            for line in self._get_lines_in_order(order['id']):
                product = self._get_product_in_line(line.product_id.id)
                TOTALS['all_products'] += 1
                TOTALS['tax'] += line.price_subtotal_incl - line.price_subtotal
                if product[1].name.upper() == 'GRATUITY':
                    TOTALS['gratuities'] += line.price_subtotal
                if self._has_category(product, 'liquor'):
                    TOTALS['liquor'] += 1
                if self._has_category(product, 'cocktails'):
                    TOTALS['cocktails'] += 1
                if self._has_category(product, 'wine'):
                    TOTALS['wine'] += 1
                if self._has_category(product, 'beer'):
                    TOTALS['beer'] += 1
                if self._has_category(product, 'non alcoholic'):
                    TOTALS['non_alcoholic'] += 1
                if self._has_category(product, 'misc'):
                    TOTALS['misc'] += 1
        TOTALS['sp_amount'] = TOTALS['collected'] - TOTALS['tax'] - TOTALS['gratuities']
        TOTALS['beverage'] = TOTALS['liquor'] + TOTALS['cocktails'] + TOTALS['wine'] + TOTALS['beer'] + TOTALS['non_alcoholic']
        TOTALS['food'] = TOTALS['all_products'] - TOTALS['misc'] - TOTALS['beverage']
        return TOTALS

    ###########################################################
    ###### local context functions ############################
    # name of category can be upper-lower case (nevermind)
    # "%.2f" % total >> always shows 'total' with two decimals

    def _get_total_food_sp(self, form):
        self._get_totals(form)
        global TOTALS
        return "%.2f" % (float(TOTALS['sp_amount']) * (float(TOTALS['food']) / float(TOTALS['all_products'])))

    def _get_total_liquor_sp(self, form):
        global TOTALS
        return "%.2f" % (float(TOTALS['sp_amount']) * (float(TOTALS['liquor']) / float(TOTALS['all_products'])))

    def _get_total_cocktail_sp(self, form):
        global TOTALS
        return "%.2f" % (float(TOTALS['sp_amount']) * (float(TOTALS['cocktails']) / float(TOTALS['all_products'])))

    def _get_total_wine_sp(self, form):
        global TOTALS
        return "%.2f" % (float(TOTALS['sp_amount']) * (float(TOTALS['wine']) / float(TOTALS['all_products'])))

    def _get_total_beer_sp(self, form):
        global TOTALS
        return "%.2f" % (float(TOTALS['sp_amount']) * (float(TOTALS['beer']) / float(TOTALS['all_products'])))

    def _get_total_nonalcoholic_sp(self, form):
        global TOTALS
        return "%.2f" % (float(TOTALS['sp_amount']) * (float(TOTALS['non_alcoholic']) / float(TOTALS['all_products'])))

    def _get_total_beverage_sp(self, form):
        global TOTALS
        return "%.2f" % (float(TOTALS['sp_amount']) * (float(TOTALS['beverage']) / float(TOTALS['all_products'])))

    def _get_total_misc_sp(self, form):
        global TOTALS
        return "%.2f" % (float(TOTALS['sp_amount']) * (float(TOTALS['misc']) / float(TOTALS['all_products'])))

    def _get_total_sales_sp(self, form):
        global TOTALS
        return "%.2f" % TOTALS['sp_amount']

    def _get_total_taxes(self, form):
        global TOTALS
        return "%.2f" % TOTALS['tax']

    def _get_total_gratuities(self, form):
        global TOTALS
        return "%.2f" % TOTALS['gratuities']

    def _get_total_collected(self, form):
        global TOTALS
        return "%.2f" % (TOTALS['collected'])

    def _get_n_of_checks(self, form):
        global TOTALS
        return "%.2f" % TOTALS['checks']

    def _get_n_of_covers(self, form):
        global TOTALS
        return "%.2f" % TOTALS['covers']

    def _get_average_check(self, form):
        global TOTALS

        if TOTALS['checks'] > 0:
            return "%.2f" % (TOTALS['sp_amount'] / TOTALS['checks'])
        else:
            return "%.2f" % 0.00

    def _get_average_cover(self, form):
        global TOTALS

        if TOTALS['checks'] > 0:
            return "%.2f" % (TOTALS['sp_amount'] / TOTALS['covers'])
        else:
            return "%.2f" % 0.00

class sp_report(osv.AbstractModel):
    _name = 'report.poi_x_hph.sp_report'
    _inherit = 'report.abstract_report'
    _template = 'poi_x_hph.sp_report'
    _wrapped_report_class = sp_report_functions

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
