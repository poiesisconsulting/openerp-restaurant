
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

import logging

import openerp
from openerp import tools
from openerp.osv import fields, osv
from openerp.tools.translate import _

_logger = logging.getLogger(__name__)

class epn_pos_statements(osv.osv):
    _inherit = 'account.bank.statement.line'
    _columns = {
        'signature': fields.binary("Signature",help="This signature provided with the payment"),
        'epn_info': fields.text('EPN Credit-Card Info', help="EPN Credit-Card Payment Information"),
    }

class epn_pos_order(osv.osv):
    _inherit = 'pos.order'

    def _payment_fields(self,ui_paymentline):
        fields = super(epn_pos_order,self)._payment_fields(ui_paymentline)
        fields['signature'] = ui_paymentline.get('signature',False)
        fields['epn_info'] = ui_paymentline.get('epn_info','')
        print  'payment_fields',fields
        return fields
    
    def _payment_fields2(self,fields):
        fields2 = super(epn_pos_order,self)._payment_fields2(fields)
        fields2['signature'] = fields.get('signature',False)
        fields2['epn_info'] = fields.get('epn_info','')
        print 'payment_fields2',fields
        return fields2
            
