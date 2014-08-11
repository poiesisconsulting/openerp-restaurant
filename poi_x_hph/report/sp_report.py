# -*- coding: utf-8 -*-
# #############################################################################
#
# OpenERP, Open Source Management Solution
# Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#
# This program is free software: you can redistribute it and/or modify
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

# Global Variables to be used in various functions
POS_SESSION_OBJ = []
POS_ORDER_OBJ = []
POS_ORDER_LINE_OBJ = []
PRODUCT_PRODUCT_OBJ = []
PRODUCT_TEMPLATE_OBJ = []
PRODUCT_PUBLIC_CATEGORY_OBJ = []

TOTAL_SP = 0.00  # => subtotal --> at pos_order_line
TOT_SP_TAX = 0.00  # => subtotal - subtotal_incl --> at pos_order_line
TOT_SP_GRATUITIES = 0.00

TOT_SP_CHECKS = 0.00
TOT_SP_COVERS = 0.00
###################################################

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
        self.context = context

        global POS_SESSION_OBJ, \
            POS_ORDER_OBJ, \
            POS_ORDER_LINE_OBJ, \
            PRODUCT_PRODUCT_OBJ, \
            PRODUCT_TEMPLATE_OBJ, \
            PRODUCT_PUBLIC_CATEGORY_OBJ
        POS_SESSION_OBJ = self.pool.get('pos.session')
        POS_ORDER_OBJ = self.pool.get('pos.order')
        POS_ORDER_LINE_OBJ = self.pool.get('pos.order.line')
        PRODUCT_PRODUCT_OBJ = self.pool.get('product.product')
        PRODUCT_TEMPLATE_OBJ = self.pool.get('product.template')
        PRODUCT_PUBLIC_CATEGORY_OBJ = self.pool.get('product.public.category')

        # reset globals
        global TOTAL_SP, TOT_SP_TAX, TOT_SP_CHECKS, TOT_SP_COVERS
        TOTAL_SP = 0.00
        TOT_SP_TAX = 0.00

        TOT_SP_CHECKS = 0.00
        TOT_SP_COVERS = 0.00

    def set_context(self, objects, data, ids, report_type=None):
        new_ids = ids
        if data['model'] == 'ir.ui.menu':
            new_ids = 'chart_account_id' in data['form'] and [data['form']['chart_account_id']] or []
            objects = self.pool.get('account.account').browse(self.cr, self.uid, new_ids)
        return super(sp_report_functions, self).set_context(objects, data, new_ids, report_type=report_type)

    def _get_sp_orders(self, form):
        start_date = form['start_date'] + ' 00:00:00'
        end_date = form['end_date'] + ' 23:59:59'
        sp_journal_id = self.pool.get("pos.order").fetch_sp_journal_id(self.cr, self.uid)  # at Bacchanal --> 12

        self.cr.execute("""
            SELECT DISTINCT ord.id as "id",
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
                AND bsl.amount > 0

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
            if self._get_total_order(order['id'])['tot_no_tax'] < 0:
                orders.remove(order)
            else:
                order['tot_no_tax'] = self._get_total_order(order['id'])['tot_no_tax']
                order['tot_w_tax'] = self._get_total_order(order['id'])['tot_w_tax']
                order['tot_no_tax_rnd'] = self._get_total_order(order['id'])['tot_no_tax_rnd']
                order['tot_w_tax_rnd'] = self._get_total_order(order['id'])['tot_w_tax_rnd']
                order['sp_percentage'] = "%.2f" % ((order['sp_amount'] / order['tot_w_tax']) * 100)
        return orders

    def _get_total_order(self, order_id):
        tot_no_tax = 0.00
        tot_w_tax = 0.00
        global POS_ORDER_OBJ
        order = POS_ORDER_OBJ.browse(self.cr, self.uid, order_id)
        for line in self.get_lines_in_order(self.cr, self.uid, order):
            tot_no_tax += line.price_subtotal
            tot_w_tax += line.price_subtotal_incl

        return {
            'tot_no_tax': tot_no_tax,
            'tot_w_tax': tot_w_tax,
            'tot_no_tax_rnd': "%.2f" % tot_no_tax,
            'tot_w_tax_rnd': "%.2f" % tot_w_tax
        }

    def get_lines_in_order(self, cr, uid, order, context=None):
        global POS_ORDER_LINE_OBJ
        order_lines_ids = POS_ORDER_LINE_OBJ.search(cr, uid, [('order_id', '=', order['id'])])
        order_lines = POS_ORDER_LINE_OBJ.browse(cr, uid, order_lines_ids, context=context)

        return order_lines

    def get_product_in_line(self, cr, uid, line, context=None):
        global PRODUCT_PRODUCT_OBJ
        global PRODUCT_TEMPLATE_OBJ

        prod_id = line.product_id.id
        product = PRODUCT_PRODUCT_OBJ.browse(cr, uid, prod_id, context=context)

        prod_tmp_id = product.product_tmpl_id.id
        product_template = PRODUCT_TEMPLATE_OBJ.browse(cr, uid, prod_tmp_id, context=context)

        product = [product, product_template]
        return product

    def get_categories_string(self, cr, uid, product, context=None):
        global PRODUCT_PUBLIC_CATEGORY_OBJ

        cat_id = product[1].public_categ_id.id
        cat_str = []
        while cat_id:
            category = PRODUCT_PUBLIC_CATEGORY_OBJ.browse(cr, uid, cat_id, context=context)
            cat_str.append([cat_id, category.name])

            cat_id = category.parent_id.id
        return cat_str

    def has_category(self, cr, uid, product, cat_name, context=None):
        for cat in self.get_categories_string(cr, uid, product):
            if cat[1].upper() == cat_name.upper():
                return True
        return False

    def get_total_category(self, cr, uid, form, cat_name, context=None):
        totals = [0.00, 0.00]
        for order in self._get_sp_orders(form):
            for line in self.get_lines_in_order(cr, uid, order):
                product = self.get_product_in_line(cr, uid, line)
                percentage = float(order['sp_percentage']) / 100
                if self.has_category(cr, uid, product, cat_name):
                    #totals[0] += line.price_subtotal * percentage  # amount without tax
                    #totals[1] += (line.price_subtotal_incl * percentage) - (line.price_subtotal * percentage)  # the tax
                    totals[0] += line.price_subtotal  # amount without tax
                    totals[1] += line.price_subtotal_incl - line.price_subtotal  # the tax
        return totals

###########################################################
###### local context functions ############################
# name of category can be upper-lower case (nevermind)
# "%.2f" % total >> always shows 'total' with two decimals

    def _get_total_food_sp(self, form):
        totals = self.get_total_category(self.cr, self.uid, form, "food")
        global TOTAL_SP, TOT_SP_TAX
        TOTAL_SP += totals[0]
        TOT_SP_TAX += totals[1]
        return "%.2f" % totals[0]

    def _get_total_liquor_sp(self, form):
        totals = self.get_total_category(self.cr, self.uid, form, "liquor")
        return "%.2f" % totals[0]

    def _get_total_cocktail_sp(self, form):
        totals = self.get_total_category(self.cr, self.uid, form, "cocktails")
        return "%.2f" % totals[0]

    def _get_total_wine_sp(self, form):
        totals = self.get_total_category(self.cr, self.uid, form, "wine")
        return "%.2f" % totals[0]

    def _get_total_beer_sp(self, form):
        totals = self.get_total_category(self.cr, self.uid, form, "beer")
        return "%.2f" % totals[0]

    def _get_total_nonalcoholic_sp(self, form):
        totals = self.get_total_category(self.cr, self.uid, form, "non alcoholic")
        return "%.2f" % totals[0]

    def _get_total_beverage_sp(self, form):
        totals = self.get_total_category(self.cr, self.uid, form, "beverage")
        global TOTAL_SP, TOT_SP_TAX
        TOTAL_SP += totals[0]
        TOT_SP_TAX += totals[1]
        return "%.2f" % totals[0]

    def _get_total_misc_sp(self, form):
        totals = self.get_total_category(self.cr, self.uid, form, "misc")
        global TOTAL_SP, TOT_SP_TAX
        TOTAL_SP += totals[0]
        TOT_SP_TAX += totals[1]
        return "%.2f" % totals[0]

    def _get_total_sales_sp(self, form):
        global TOTAL_SP
        return "%.2f" % TOTAL_SP

    def _get_total_taxes(self, form):
        global TOT_SP_TAX
        return "%.2f" % TOT_SP_TAX

    def _get_total_gratuities(self, form):
        global TOT_SP_GRATUITIES
        TOT_SP_GRATUITIES = 0.00
        for order in self._get_sp_orders(form):
            for line in self.get_lines_in_order(self.cr, self.uid, order):
                product = self.get_product_in_line(self.cr, self.uid, line)
                if product[1].name.upper() == 'GRATUITY' and line.price_subtotal >= 0:
                    TOT_SP_GRATUITIES += line.price_subtotal

        return TOT_SP_GRATUITIES

    def _get_total_collected(self, form):
        global TOTAL_SP, TOT_SP_TAX, TOT_SP_GRATUITIES
        return "%.2f" % (TOTAL_SP + TOT_SP_TAX + TOT_SP_GRATUITIES)

    def _get_n_of_checks(self, form):
        sp_orders = self._get_sp_orders(form)
        global TOT_SP_CHECKS
        TOT_SP_CHECKS = sp_orders.__len__()
        return "%.2f" % TOT_SP_CHECKS

    def _get_n_of_covers(self, form):
        sp_orders = self._get_sp_orders(form)
        global TOT_SP_COVERS
        for order in sp_orders:
            TOT_SP_COVERS += order['covers']
        return "%.2f" % TOT_SP_COVERS

    def _get_average_check(self, form):
        global TOTAL_SP, TOT_SP_CHECKS
        if TOT_SP_CHECKS > 0:
            return "%.2f" % (TOTAL_SP / TOT_SP_CHECKS)
        else:
            return "%.2f" % 0.00

    def _get_average_cover(self, form):
        global TOTAL_SP, TOT_SP_COVERS
        if TOT_SP_COVERS > 0:
            return "%.2f" % (TOTAL_SP / TOT_SP_COVERS)
        else:
            return "%.2f" % 0.00

class sp_report(osv.AbstractModel):
    _name = 'report.poi_x_hph.sp_report'
    _inherit = 'report.abstract_report'
    _template = 'poi_x_hph.sp_report'
    _wrapped_report_class = sp_report_functions

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
